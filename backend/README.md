# 🧭 Velocity Zone Manager

A full-stack, spatial mower fleet management dashboard for TerraSync's Velocity platform. This application allows operators to manage commercial turf properties, draw operational zones on an interactive map, and calculate mower allocations and overlaps.

---

## 🛠️ Tech Stack & Architecture

*   **Frontend**: React (TypeScript, Vite), OpenLayers for interactive mapping, and Tailwind CSS.
*   **Backend**: Python Flask REST API with Flask-SQLAlchemy.
*   **Database**: PostgreSQL with **PostGIS** spatial extension.
*   **Containerization**: Orchestrated using Docker Compose (3 services: frontend, backend, postgres).

---

## 💾 Database Choice Justification

We store geometry coordinates in a **JSONB** column in PostgreSQL, but we perform all calculations and relations using **PostGIS** functions (`ST_GeomFromGeoJSON`, `ST_Area`, `ST_Intersects`).

### Why this approach?
1. **API Serialization Simplicity**: Storing geometry as JSONB allows native compatibility with GeoJSON Feature objects on the frontend (OpenLayers) and Flask API controllers. There is no translation overhead (no WKB/WKT parsing/encoding) when reading or writing zones.
2. **PostGIS Query-Time Power**: Rather than writing complex geographical math in Python, we delegate area calculations (`ST_Area(ST_GeomFromGeoJSON(geom)::geography)`) and zone overlap conflicts (`ST_Intersects`) directly to the PostgreSQL database.
3. **No Schema Coupling**: It keeps the SQLAlchemy schema highly portable while unlocking the full, indexed geographical query performance of PostGIS on our production instance.

---

## ⚙️ Environment Configuration

> [!IMPORTANT]
> The database credentials and host port mappings are managed in a separate `.env` file at the root of the project. 

Before running the application, make sure the `.env` file exists in the root directory. You can customize the credentials and host ports there:

```env
# --- Database Setup ---
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=velocity

# --- Host Port Mapping (Change these to resolve conflicts) ---
POSTGRES_PORT_HOST=5432
BACKEND_PORT_HOST=5000
FRONTEND_PORT_HOST=3000

# --- Security and Debugging ---
JWT_SECRET=velocity_jwt_secret_key_12345
FLASK_ENV=development
FLASK_DEBUG=1