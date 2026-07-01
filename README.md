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

We store geometry coordinates in a **JSONB** column in PostgreSQL, but we perform all calculations and relations using **PostGIS** functions (\`ST_GeomFromGeoJSON\`, \`ST_Area\`, \`ST_Intersects\`).

### Why this approach?
1. **API Serialization Simplicity**: Storing geometry as JSONB allows native compatibility with GeoJSON Feature objects on the frontend (OpenLayers) and Flask API controllers. There is no translation overhead (no WKB/WKT parsing/encoding) when reading or writing zones.
2. **PostGIS Query-Time Power**: Rather than writing complex geographical math in Python, we delegate area calculations (\`ST_Area(ST_GeomFromGeoJSON(geom)::geography)\`) and zone overlap conflicts (\`ST_Intersects\`) directly to the PostgreSQL database.
3. **No Schema Coupling**: It keeps the SQLAlchemy schema highly portable while unlocking the full, indexed geographical query performance of PostGIS on our production instance.

---

## ⚙️ Environment Configuration

Before running the application, make sure the \`.env\` file exists in the root directory. You can customize the credentials and host ports there:

\`\`\`env
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
\`\`\`

---

## 🚀 Setup & Running the App

### Prerequisites
*   Docker and Docker Compose installed and running.

### Step-by-Step Launch
1. **Clone the repository and enter the directory**:
   \`\`\`bash
   git clone https://github.com/Sailakshmi-Prs/velocity-zone-manager.git
   cd velocity-zone-manager
   \`\`\`
2. **Boot up the Docker stack**:
   \`\`\`bash
   docker compose up --build
   \`\`\`
   *On first boot, the system automatically enables the \`postgis\` extension, creates the schema, and runs \`seed.py\` to populate the **Bengaluru Golf Club** with 3 pre-drawn zones.*

3. **Access the Services**:
   *   **Frontend Web App**: http://localhost:3000
   *   **Backend Rest API**: http://localhost:5000
   *   **Postgres Database**: localhost:5432

---

## ⚡ Troubleshooting & Common Errors

### 🔴 Error: \`port is already allocated\` or \`address already in use\`
This occurs when local services (like a local Postgres server, another Node app, or Flask) are already running on ports \`5432\`, \`3000\`, or \`5000\`.

**Solution**:
1. Open the \`.env\` file in the root of the project.
2. Change the host port mappings to any free ports (e.g., change \`POSTGRES_PORT_HOST\` to \`5433\`, \`BACKEND_PORT_HOST\` to \`5001\`, or \`FRONTEND_PORT_HOST\` to \`3001\`):
   \`\`\`env
   POSTGRES_PORT_HOST=5433
   BACKEND_PORT_HOST=5001
   FRONTEND_PORT_HOST=3001
   \`\`\`
3. Restart the stack:
   \`\`\`bash
   docker compose down
   docker compose up --build
   \`\`\`

### 🔴 Error: \`Virtualization support not detected\` (Docker Desktop)
This occurs if hardware virtualization is disabled in your system's BIOS/firmware.

**Solution**:
1. Restart your PC, enter the BIOS settings (usually by pressing \`F2\` or \`Delete\` during boot).
2. Find **Intel Virtualization Technology** (for Intel CPUs) or **SVM Mode** (for AMD CPUs) and set it to **Enabled**.
3. Save changes (\`F10\`) and restart.
4. *Alternatively*, run the project in a cloud sandbox environment like **GitHub Codespaces** or **Gitpod**, which runs Docker Compose natively without local hypervisor requirements.

---

## 🧪 Running Unit Tests

The backend includes automated integration tests verifying JWT authentication, database constraints, and mower validations.

Run the tests inside the Docker container:
\`\`\`bash
docker compose exec backend pytest
\`\`\`

---

## 🤖 AI Workflow

### Q1: Which AI tool(s) did you use, and what specifically did you use each one for?
We used **Google Antigravity (Gemini 3.5 Flash)** to:
*   Generate SQL schemas and backend REST API routing in Flask (\`app.py\`).
*   Implement the spatial area converter math on the database server.
*   Build the OpenLayers map layer interactions (Polygon draw/modify events) in React.
*   Formulate the complex polygon winding ray-intersection algorithm in TypeScript for the back-and-forth mower path simulation.

### Q2: Give one concrete example of AI output you accepted with no changes. Paste the prompt you gave and the output you used.
We accepted the **mowing path vertical ray-intersection algorithm** in \`MapContainer.tsx\` to project parallel lines inside concave/convex polygons.

*Prompt:*
> "Write a winding back-and-forth line generator inside an OpenLayers Polygon geometry using vertical stripes. Spacing should be customizable in meters. Use EPSG:3857 coordinates so it scales correctly on the map."

*Output Used (No modifications):*
\`\`\`typescript
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
    const coordinates = polygon.getCoordinates()[0];

    for (let i = 0; i < coordinates.length - 1; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];

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
\`\`\`

### Q3: Give one concrete example of AI output you rejected or significantly edited. What was wrong with it? What did you change?
We rejected the initial suggestion for \`seed.py\` coordinates. The AI initially generated basic \`[0, 0]\` region boundaries which produced \`0\` calculated acreage and invalid overlaps. 

*What was wrong*: The coordinates did not place the property in Bengaluru as specified, and the acreage computation resolved to empty maps.

*What we changed*: We mapped real-world geographical coordinates around the actual Bengaluru Golf Club \`[77.5878, 12.9912]\` with precise box margins (0.002 degrees) to calculate realistic acreages (11.85 acres) and create staffed vs. understaffed zone variants for visual demonstration.

### Q4: Name one part of this task where AI was not useful and you did it yourself. Why wasn't AI the right tool there?
Managing Node.js/npm environments and Docker lifecycle operations. Initially, the AI proposed running \`npx create-vite\` on the host machine. However, because host systems often lack globally installed packages or have unique configurations, this command failed. 

We resolved this by writing the project package configs, typescript definitions, and Dockerfiles manually, allowing Docker to build and bundle the environment consistently in isolation without depending on the host machine's configuration.
