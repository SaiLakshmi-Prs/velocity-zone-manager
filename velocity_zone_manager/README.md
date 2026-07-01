# Velocity Zone Manager

A full-stack mower fleet management application for TerraSync's Velocity platform.

## Architecture

- **Frontend**: React (TypeScript, Vite), OpenLayers for interactive mapping, and Tailwind CSS.
- **Backend**: Python Flask REST API with SQLAlchemy.
- **Database**: PostgreSQL with PostGIS extension enabled.
- **Containerization**: Orchestrated using Docker Compose (3 services: frontend, backend, postgres).

---

## Database Choice Justification

We store geometry coordinates in a **JSONB** (or JSON) column in PostgreSQL, but we perform spatial operations using **PostGIS** functions (`ST_GeomFromGeoJSON`, `ST_Area`, `ST_Intersects`).

### Why this approach?
1. **API Serialization Simplicity**: Storing geometry as JSONB allows native compatibility with GeoJSON Feature objects on the frontend (OpenLayers) and Flask API controllers. There is no translation overhead (no WKB/WKT parsing/encoding) when reading or writing zones.
2. **PostGIS Query-Time Power**: Rather than writing complex geographical math in Python, we delegate area calculations (`ST_Area(ST_GeomFromGeoJSON(geom)::geography)`) and zone overlap conflicts (`ST_Intersects`) directly to the PostgreSQL database.
3. **No Schema Coupling**: It keeps the SQLAlchemy schema highly portable while unlocking the full, indexed geographical query performance of PostGIS on our production instance.

---

## Setup & Running the App

The entire application runs inside Docker.

### Prerequisites
- [Docker](https://www.docker.com/) and Docker Compose installed.

### Step 1: Clone the repository and navigate to the directory
```bash
cd velocity_zone_manager
```

### Step 2: Boot up the containers
Build and start all services (database, backend API, and React client):
```bash
docker compose up --build
```
On the first boot:
- The database schema is created.
- The `postgis` extension is registered.
- Seeding runs automatically, creating the **Bengaluru Golf Club** property with **3 pre-drawn zones** (Fairway 1, Rough A, and Exclusion Zone B).

### Accessing the services
- **Frontend Panel**: [http://localhost:3000](http://localhost:3000)
- **Backend Rest API**: [http://localhost:5000](http://localhost:5000)
- **Postgres Database**: `localhost:5432`

---

## Running Unit Tests

The backend includes `pytest` integration tests verifying Auth registration and zone mower validators (e.g. mower count constraints, understaffed computations).

Run tests inside the backend container:
```bash
docker compose exec backend pytest
```

---

## AI Workflow

### Q1: Which AI tool(s) did you use, and what specifically did you use each one for?
We used **Google Antigravity (Gemini 3.5 Flash)** to:
- Generate SQL schemas and backend REST API routing in Flask (`app.py`).
- Implement the spatial area converter math on the database server.
- Build the OpenLayers map layer interactions (Polygon draw/modify events) in React.
- Formulate the complex polygon winding ray-intersection algorithm in TypeScript for the back-and-forth mower path simulation.

### Q2: Give one concrete example of AI output you accepted with no changes. Paste the prompt you gave and the output you used.
We accepted the **mowing path vertical ray-intersection algorithm** in `MapContainer.tsx` to project parallel lines inside concave/convex polygons.

*Prompt:*
> "Write a winding back-and-forth line generator inside an OpenLayers Polygon geometry using vertical stripes. Spacing should be customizable in meters. Use EPSG:3857 coordinates so it scales correctly on the map."

*Output Used (No modifications):*
```typescript
const generateMowingPaths = (polygon: Polygon, spacingMeters = 25): LineString[] => {
  const extent = polygon.getExtent();
  const minX = extent[0];
  const minY = extent[1];
  const maxX = extent[2];
  const maxY = extent[3];
  
  const paths: LineString[] = [];
  let count = 0;

  for (let x = minX + spacingMeters / 2; x < maxX; x += spacingMeters) {
    const intersections: number[] = [];
    const coordinates = polygon.getCoordinates()[0]; // Outer ring

    for (let i = 0; i < coordinates.length - 1; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];

      // Ray check
      if ((p1[0] <= x && p2[0] > x) || (p2[0] <= x && p1[0] > x)) {
        const t = (x - p1[0]) / (p2[0] - p1[0]);
        const y = p1[1] + t * (p2[1] - p1[1]);
        intersections.push(y);
      }
    }

    intersections.sort((a, b) => a - b);

    for (let i = 0; i < intersections.length - 1; i += 2) {
      const yStart = intersections[i];
      const yEnd = intersections[i + 1];
      
      const coords = count % 2 === 0 
        ? [[x, yStart], [x, yEnd]] 
        : [[x, yEnd], [x, yStart]];
      paths.push(new LineString(coords));
    }
    count++;
  }
  return paths;
};
```

### Q3: Give one concrete example of AI output you rejected or significantly edited. What was wrong with it? What did you change?
We rejected the initial suggestion for `seed.py` coordinates. The AI initially generated basic `[0, 0]` region boundaries which produced `0` calculated acreage and invalid overlaps. 

*What was wrong*: The coordinates did not place the property in Bengaluru as specified, and the acreage computation resolved to empty maps.

*What we changed*: We mapped real-world geographical coordinates around the actual Bengaluru Golf Club `[77.5878, 12.9912]` with precise box margins (0.002 degrees) to calculate realistic acreages (11.85 acres) and create staffed vs. understaffed zone variants for visual demonstration.

### Q4: Name one part of this task where AI was not useful and you did it yourself. Why wasn't AI the right tool there?
Managing Node.js/npm environments and Docker lifecycle operations. Initially, the AI proposed running `npx create-vite` on the host machine. However, because host systems often lack globally installed packages or have unique configurations, this command failed. 
We resolved this by writing the project package configs, typescript definitions, and Dockerfiles manually, allowing Docker to build and bundle the environment consistently in isolation without depending on the host machine's configuration.
