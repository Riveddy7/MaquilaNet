# **App Name**: MaquilaNet Control

## Core Features:

- User Authentication: User authentication via Firebase (email/password, Google Sign-In).
- Location Management: Management (CRUD) of IDF/MDF locations with hierarchical display.
- Equipment Management: Management (CRUD) of network equipment (switches, routers, etc.).
- Port Management: Conceptual management of equipment ports with status tracking.
- Node Management: Management (CRUD) of end-user nodes (PCs, printers, etc.).
- RFID Census Initiation: Initiate a RFID census by specifying the IDF/MDF, pasting the RFID tag list into the interface, and start processing.
- RFID Census Processing: Compares scanned RFID tags with expected inventory.  Identifies missing equipment and unregistered tags, and creates a log of each scan. This is implemented as a tool

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust and stability.
- Background color: Light gray (#F0F2F5), creating a clean and modern look.
- Accent color: Vivid orange (#FF9800) for interactive elements and calls to action.
- Body and headline font: 'Inter' sans-serif for a clean and modern aesthetic.
- Use minimalist line icons to represent equipment, locations, and status.
- Dashboard layout with a consistent sidebar for navigation and a main content area.
- Subtle transitions and animations to provide feedback on user interactions (e.g., loading states).