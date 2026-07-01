import os
import json
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from sqlalchemy import text, or_

from models import db, User, Property, Zone
from auth import generate_token, login_required
from seed import seed_db

app = Flask(__name__)
# Enable CORS for the frontend origin
CORS(app, resources={r"/*": {"origins": "*"}})

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/velocity'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Helper function to calculate acreage of a geometry dict using PostGIS
def calculate_acreage_db(geometry_dict):
    try:
        geom_json_str = json.dumps(geometry_dict)
        # ST_GeomFromGeoJSON returns geometry. Cast to geography to get area in square meters,
        # then convert to acres (1 sq meter = 0.000247105 acres).
        query = text("SELECT ST_Area(ST_GeomFromGeoJSON(:geom)::geography) AS area_sq_m")
        result = db.session.execute(query, {'geom': geom_json_str}).fetchone()
        if result and result[0] is not None:
            return result[0] * 0.000247105
    except Exception as e:
        print(f"Error calculating acreage via DB: {e}")
    return 0.0

# Helper to find zone conflict overlaps in database
def find_property_zone_conflicts(property_id):
    conflicts = {}
    try:
        # Check if ST_Area(ST_Intersection(g1, g2)) > 1.0 square meter.
        # This excludes zones that merely touch boundaries.
        query = text("""
            SELECT z1.id, z2.id 
            FROM zones z1
            JOIN zones z2 ON z1.id < z2.id AND z1.property_id = z2.property_id
            WHERE z1.property_id = :prop_id
              AND ST_Intersects(ST_GeomFromGeoJSON(z1.geometry::text), ST_GeomFromGeoJSON(z2.geometry::text))
              AND ST_Area(ST_Intersection(ST_GeomFromGeoJSON(z1.geometry::text)::geography, ST_GeomFromGeoJSON(z2.geometry::text)::geography)) > 1.0
        """)
        results = db.session.execute(query, {'prop_id': property_id}).fetchall()
        for r in results:
            z1_id, z2_id = r[0], r[1]
            if z1_id not in conflicts:
                conflicts[z1_id] = []
            if z2_id not in conflicts:
                conflicts[z2_id] = []
            conflicts[z1_id].append(z2_id)
            conflicts[z2_id].append(z1_id)
    except Exception as e:
        print(f"Error finding zone conflicts: {e}")
    return conflicts

# Shared validation helper for Zone creation/updating (TER-S02)
def validate_zone_data(data):
    mower_count = data.get('mower_count')
    if mower_count is None:
        return "mower_count is required."
    try:
        mower_count = int(mower_count)
    except (ValueError, TypeError):
        return "mower_count must be an integer."
    
    # TER-S02 Validation: mower_count = 0 must return 400
    if mower_count == 0:
        return "A zone must have at least one assigned mower."
    if mower_count < 0:
        return "Mower count cannot be negative."
        
    name = data.get('name')
    if not name or not name.strip():
        return "Zone name is required."
        
    zone_type = data.get('type')
    if not zone_type or zone_type not in ['fairway', 'rough', 'perimeter', 'exclusion']:
        return "Type must be one of: 'fairway', 'rough', 'perimeter', 'exclusion'."
        
    status = data.get('status')
    if not status or status not in ['active', 'inactive']:
        return "Status must be 'active' or 'inactive'."
        
    geometry = data.get('geometry')
    if not geometry:
        return "Geometry is required."
    if not isinstance(geometry, dict) or 'type' not in geometry or 'coordinates' not in geometry:
        return "Geometry must be a valid GeoJSON object."
    if geometry['type'] != 'Polygon':
        return "Geometry must be a Polygon."
        
    return None

def enrich_zone(zone, conflicts_dict=None):
    acreage = calculate_acreage_db(zone.geometry)
    understaffed = acreage > (zone.mower_count * 2)
    zone_dict = zone.to_dict()
    zone_dict['acreage'] = round(acreage, 2)
    zone_dict['understaffed'] = understaffed
    zone_dict['conflicts'] = conflicts_dict.get(zone.id, []) if conflicts_dict else []
    return zone_dict

# ----------------- Auth Endpoints -----------------

@app.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'A user with this email already exists.'}), 400
        
    user = User(email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    token = generate_token(user.id)
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 201

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password.'}), 401
        
    token = generate_token(user.id)
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200

# ----------------- Properties Endpoints -----------------

@app.route('/properties', methods=['GET'])
@login_required
def get_properties():
    query_str = request.args.get('search', '')
    prop_type = request.args.get('type', '')
    min_acreage = request.args.get('min_acreage')
    max_acreage = request.args.get('max_acreage')
    
    query = Property.query
    
    if query_str:
        query = query.filter(or_(
            Property.name.ilike(f'%{query_str}%'),
            Property.type.ilike(f'%{query_str}%')
        ))
        
    if prop_type:
        query = query.filter(Property.type == prop_type)
        
    if min_acreage:
        try:
            query = query.filter(Property.total_acreage >= float(min_acreage))
        except ValueError:
            pass
            
    if max_acreage:
        try:
            query = query.filter(Property.total_acreage <= float(max_acreage))
        except ValueError:
            pass
            
    properties = query.order_by(Property.name).all()
    return jsonify([p.to_dict() for p in properties]), 200

@app.route('/properties', methods=['POST'])
@login_required
def create_property():
    data = request.get_json() or {}
    name = data.get('name')
    prop_type = data.get('type')
    total_acreage = data.get('total_acreage')
    notes = data.get('notes', '')
    
    if not name or not name.strip():
        return jsonify({'error': 'Property name is required.'}), 400
    if not prop_type or prop_type not in ['golf_course', 'airport', 'corporate_campus', 'other']:
        return jsonify({'error': 'Property type must be one of: golf_course, airport, corporate_campus, other.'}), 400
    try:
        total_acreage = float(total_acreage)
        if total_acreage < 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'Total acreage must be a positive number.'}), 400
        
    property_obj = Property(
        name=name,
        type=prop_type,
        total_acreage=total_acreage,
        notes=notes
    )
    db.session.add(property_obj)
    db.session.commit()
    return jsonify(property_obj.to_dict()), 201

@app.route('/properties/<int:property_id>', methods=['GET'])
@login_required
def get_property(property_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
    return jsonify(property_obj.to_dict()), 200

@app.route('/properties/<int:property_id>', methods=['PUT'])
@login_required
def update_property(property_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
        
    data = request.get_json() or {}
    name = data.get('name')
    prop_type = data.get('type')
    total_acreage = data.get('total_acreage')
    notes = data.get('notes')
    
    if name is not None:
        if not name.strip():
            return jsonify({'error': 'Property name cannot be empty.'}), 400
        property_obj.name = name
    if prop_type is not None:
        if prop_type not in ['golf_course', 'airport', 'corporate_campus', 'other']:
            return jsonify({'error': 'Invalid property type.'}), 400
        property_obj.type = prop_type
    if total_acreage is not None:
        try:
            total_acreage = float(total_acreage)
            if total_acreage < 0:
                raise ValueError()
            property_obj.total_acreage = total_acreage
        except (ValueError, TypeError):
            return jsonify({'error': 'Total acreage must be a positive number.'}), 400
    if notes is not None:
        property_obj.notes = notes
        
    db.session.commit()
    return jsonify(property_obj.to_dict()), 200

@app.route('/properties/<int:property_id>', methods=['DELETE'])
@login_required
def delete_property(property_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
    db.session.delete(property_obj)
    db.session.commit()
    return jsonify({'message': 'Property deleted successfully.'}), 200

# ----------------- Zones Endpoints -----------------

@app.route('/properties/<int:property_id>/zones', methods=['GET'])
@login_required
def get_zones(property_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
        
    zones = Zone.query.filter_by(property_id=property_id).all()
    conflicts = find_property_zone_conflicts(property_id)
    
    enriched = [enrich_zone(z, conflicts) for z in zones]
    return jsonify(enriched), 200

@app.route('/properties/<int:property_id>/zones', methods=['POST'])
@login_required
def create_zone(property_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
        
    data = request.get_json() or {}
    validation_err = validate_zone_data(data)
    if validation_err:
        return jsonify({'error': validation_err}), 400
        
    zone = Zone(
        property_id=property_id,
        name=data['name'],
        type=data['type'],
        mower_count=int(data['mower_count']),
        status=data['status'],
        geometry=data['geometry']
    )
    db.session.add(zone)
    db.session.commit()
    
    conflicts = find_property_zone_conflicts(property_id)
    return jsonify(enrich_zone(zone, conflicts)), 201

@app.route('/properties/<int:property_id>/zones/<int:zone_id>', methods=['PUT'])
@login_required
def update_zone(property_id, zone_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
        
    zone = Zone.query.filter_by(id=zone_id, property_id=property_id).first()
    if not zone:
        return jsonify({'error': 'Zone not found.'}), 404
        
    data = request.get_json() or {}
    validation_err = validate_zone_data(data)
    if validation_err:
        return jsonify({'error': validation_err}), 400
        
    zone.name = data['name']
    zone.type = data['type']
    zone.mower_count = int(data['mower_count'])
    zone.status = data['status']
    zone.geometry = data['geometry']
    
    db.session.commit()
    
    conflicts = find_property_zone_conflicts(property_id)
    return jsonify(enrich_zone(zone, conflicts)), 200

@app.route('/properties/<int:property_id>/zones/<int:zone_id>', methods=['DELETE'])
@login_required
def delete_zone(property_id, zone_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
        
    zone = Zone.query.filter_by(id=zone_id, property_id=property_id).first()
    if not zone:
        return jsonify({'error': 'Zone not found.'}), 404
        
    db.session.delete(zone)
    db.session.commit()
    return jsonify({'message': 'Zone deleted successfully.'}), 200

@app.route('/properties/<int:property_id>/zones/summary', methods=['GET'])
@login_required
def get_zones_summary(property_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
        
    zones = Zone.query.filter_by(property_id=property_id).all()
    
    total_zones = len(zones)
    total_acreage = 0.0
    total_mowers = 0
    understaffed_count = 0
    
    for z in zones:
        acreage = calculate_acreage_db(z.geometry)
        total_acreage += acreage
        total_mowers += z.mower_count
        if acreage > (z.mower_count * 2):
            understaffed_count += 1
            
    return jsonify({
        'total_zones': total_zones,
        'total_acreage': round(total_acreage, 2),
        'total_mowers_assigned': total_mowers,
        'understaffed_count': understaffed_count
    }), 200

@app.route('/properties/<int:property_id>/zones/export', methods=['GET'])
@login_required
def export_zones(property_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
        
    zones = Zone.query.filter_by(property_id=property_id).all()
    
    features = []
    for z in zones:
        feature = {
            'type': 'Feature',
            'id': z.id,
            'geometry': z.geometry,
            'properties': {
                'name': z.name,
                'type': z.type,
                'mower_count': z.mower_count,
                'status': z.status
            }
        }
        features.append(feature)
        
    feature_collection = {
        'type': 'FeatureCollection',
        'features': features
    }
    return jsonify(feature_collection), 200

@app.route('/properties/<int:property_id>/zones/import', methods=['POST'])
@login_required
def import_zones(property_id):
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found.'}), 404
        
    geojson = request.get_json() or {}
    if not geojson or geojson.get('type') != 'FeatureCollection':
        return jsonify({'error': 'Uploaded file must be a valid GeoJSON FeatureCollection.'}), 400
        
    features = geojson.get('features')
    if not isinstance(features, list):
        return jsonify({'error': 'GeoJSON FeatureCollection must contain a features array.'}), 400
        
    # Validate features first (prevent partial imports)
    parsed_zones = []
    for i, feature in enumerate(features):
        if not isinstance(feature, dict) or feature.get('type') != 'Feature':
            return jsonify({'error': f'Feature at index {i} is invalid.'}), 400
            
        geometry = feature.get('geometry')
        if not geometry or not isinstance(geometry, dict):
            return jsonify({'error': f'Feature at index {i} must contain a geometry.'}), 400
            
        # Reject non-polygon geometry as per differentiator
        if geometry.get('type') != 'Polygon':
            return jsonify({'error': f"Feature at index {i} geometry type must be 'Polygon'. Found '{geometry.get('type')}'."}), 400
            
        props = feature.get('properties', {})
        if not isinstance(props, dict):
            props = {}
            
        # Extract and default properties
        name = props.get('name', f"Zone {i+1}").strip()
        z_type = props.get('type', 'rough')
        if z_type not in ['fairway', 'rough', 'perimeter', 'exclusion']:
            z_type = 'rough'
            
        mower_count = props.get('mower_count')
        if mower_count is None:
            mower_count = 1
        try:
            mower_count = int(mower_count)
        except (ValueError, TypeError):
            mower_count = 1
            
        if mower_count == 0:
            return jsonify({'error': f"Feature at index {i} ('{name}') has mower_count = 0. A zone must have at least one assigned mower."}), 400
        if mower_count < 0:
            return jsonify({'error': f"Feature at index {i} ('{name}') has negative mower_count."}), 400
            
        status = props.get('status', 'active')
        if status not in ['active', 'inactive']:
            status = 'active'
            
        parsed_zones.append(Zone(
            property_id=property_id,
            name=name,
            type=z_type,
            mower_count=mower_count,
            status=status,
            geometry=geometry
        ))
        
    # Validation passed, delete existing zones and replace
    try:
        Zone.query.filter_by(property_id=property_id).delete()
        for pz in parsed_zones:
            db.session.add(pz)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f"Database import error: {str(e)}"}), 500
        
    conflicts = find_property_zone_conflicts(property_id)
    updated_zones = Zone.query.filter_by(property_id=property_id).all()
    return jsonify([enrich_zone(z, conflicts) for z in updated_zones]), 200

# ----------------- App Boot Initialization -----------------

@app.before_request
def initialize():
    # Only run database initialization once
    if not hasattr(app, '_db_initialized'):
        app._db_initialized = True
        try:
            db.create_all()
            # Enable postgis if needed
            db.session.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            db.session.commit()
            print("PostgreSQL tables created & PostGIS extension enabled.")
        except Exception as e:
            print("Warning: Database schema initialization failed or PostGIS not available yet:", e)
            db.session.rollback()
            
        # Seed database
        try:
            seed_db()
        except Exception as e:
            print("Warning: Database seeding failed:", e)

if __name__ == '__main__':
    # Bind to 0.0.0.0 for Docker
    app.run(host='0.0.0.0', port=5000)
