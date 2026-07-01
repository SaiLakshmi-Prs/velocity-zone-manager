import pytest
import json
from unittest.mock import patch
from app import app, db
from models import User, Property, Zone

@pytest.fixture
def client():
    app.config['TESTING'] = True
    # Use SQLite in-memory database for testing
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

def test_signup_and_login(client):
    # Test signup
    response = client.post('/auth/signup', json={
        'email': 'test@terrasync.com',
        'password': 'password123'
    })
    assert response.status_code == 201
    data = response.get_json()
    assert 'token' in data
    assert data['user']['email'] == 'test@terrasync.com'

    # Test login
    response = client.post('/auth/login', json={
        'email': 'test@terrasync.com',
        'password': 'password123'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert 'token' in data

    # Test invalid login
    response = client.post('/auth/login', json={
        'email': 'test@terrasync.com',
        'password': 'wrongpassword'
    })
    assert response.status_code == 401

def test_zone_mower_count_validation(client):
    # Register and login to get JWT token
    resp = client.post('/auth/signup', json={
        'email': 'operator@terrasync.com',
        'password': 'securepassword'
    })
    token = resp.get_json()['token']
    headers = {'Authorization': f'Bearer {token}'}

    # Create a property first
    prop_resp = client.post('/properties', json={
        'name': 'Test Club',
        'type': 'golf_course',
        'total_acreage': 100.0,
        'notes': 'Test notes'
    }, headers=headers)
    assert prop_resp.status_code == 201
    prop_id = prop_resp.get_json()['id']

    # Mock the PostGIS functions
    with patch('app.calculate_acreage_db', return_value=5.5), \
         patch('app.find_property_zone_conflicts', return_value={}):
         
        # Test creating a zone with mower_count = 0 (TER-S02 validation)
        zone_payload = {
            'name': 'Green A',
            'type': 'fairway',
            'mower_count': 0,
            'status': 'active',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [
                    [
                        [77.0, 12.0],
                        [77.1, 12.0],
                        [77.1, 12.1],
                        [77.0, 12.1],
                        [77.0, 12.0]
                    ]
                ]
            }
        }
        response = client.post(f'/properties/{prop_id}/zones', json=zone_payload, headers=headers)
        assert response.status_code == 400
        data = response.get_json()
        assert data['error'] == 'A zone must have at least one assigned mower.'

        # Test creating a zone with valid mower_count
        zone_payload['mower_count'] = 4
        response = client.post(f'/properties/{prop_id}/zones', json=zone_payload, headers=headers)
        assert response.status_code == 201
        data = response.get_json()
        assert data['name'] == 'Green A'
        assert data['mower_count'] == 4
        assert data['understaffed'] is False # acreage=5.5, mower_count=4, 5.5 <= 8 -> understaffed is False

        # Test understaffed zone creation (acreage=5.5, mower_count=1, capacity=2 -> understaffed is True)
        zone_payload['name'] = 'Green B'
        zone_payload['mower_count'] = 1
        response = client.post(f'/properties/{prop_id}/zones', json=zone_payload, headers=headers)
        assert response.status_code == 201
        data = response.get_json()
        assert data['understaffed'] is True
