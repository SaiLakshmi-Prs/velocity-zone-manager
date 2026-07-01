import json
from models import db, Property, Zone

def seed_db():
    # Check if there are any properties
    if Property.query.first() is not None:
        print("Database already seeded.")
        return

    print("Seeding database...")

    # Create demo property
    bengaluru_golf = Property(
        name="Bengaluru Golf Club",
        type="golf_course",
        total_acreage=120.0,
        notes="Premier 18-hole championship course in the heart of Bengaluru. Features challenges for all skill levels and state of the art facilities."
    )
    db.session.add(bengaluru_golf)
    db.session.flush() # Get the property ID

    # Pre-drawn zones (around coordinates 77.5878, 12.9912)
    # Zone 1: Fairway 1 (understaffed: 11.85 acres, 3 mowers. Capacity: 6 acres)
    zone1 = Zone(
        property_id=bengaluru_golf.id,
        name="Fairway 1",
        type="fairway",
        mower_count=3,
        status="active",
        geometry={
            "type": "Polygon",
            "coordinates": [
                [
                    [77.586, 12.992],
                    [77.588, 12.992],
                    [77.588, 12.990],
                    [77.586, 12.990],
                    [77.586, 12.992]
                ]
            ]
        }
    )

    # Zone 2: Rough A (well-staffed: 11.85 acres, 10 mowers. Capacity: 20 acres)
    zone2 = Zone(
        property_id=bengaluru_golf.id,
        name="Rough A",
        type="rough",
        mower_count=10,
        status="active",
        geometry={
            "type": "Polygon",
            "coordinates": [
                [
                    [77.588, 12.992],
                    [77.590, 12.992],
                    [77.590, 12.990],
                    [77.588, 12.990],
                    [77.588, 12.992]
                ]
            ]
        }
    )

    # Zone 3: Exclusion Zone B (understaffed: 11.85 acres, 1 mower. Capacity: 2 acres)
    zone3 = Zone(
        property_id=bengaluru_golf.id,
        name="Exclusion Zone B",
        type="exclusion",
        mower_count=1,
        status="active",
        geometry={
            "type": "Polygon",
            "coordinates": [
                [
                    [77.586, 12.990],
                    [77.588, 12.990],
                    [77.588, 12.988],
                    [77.586, 12.988],
                    [77.586, 12.990]
                ]
            ]
        }
    )

    db.session.add(zone1)
    db.session.add(zone2)
    db.session.add(zone3)
    db.session.commit()
    print("Database seeding completed.")
