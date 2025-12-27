# APEX Performance

**APEX Performance** is an advanced AI-driven coaching engine designed to optimize athletic training through holistic bio-mechanical analysis. Unlike traditional training logs that react to past data, APEX acts as a prescriptive reasoning engine, dynamically adjusting training loads based on real-time factors like physiological readiness (HRV/RHR), fueling status, and structural integrity (niggle scores).

## Core Architecture: The "APEX OS"

The system is built on a modular "OS" architecture that governs the athlete's daily training decisions:

- **Prescriptive Scheduler**: Generates tactical daily workouts based on long-term periodization and immediate readiness.
- **Dynamic Volume Governor**: Regulates training volume (tonnage/distance) to prevent overtraining while ensuring progressive overload.
- **Smart Adherence Calculator**: Tracks compliance and adjusts future plans based on missed or modified sessions.
- **Metabolic Flexibility Context**: Integrates fueling strategies (carbs per hour, GI distress) into the training equation.
- **Phenotype Profiling**: Customizes training zones and recovery curves based on individual athlete profiles (Power, Endurance, etc.).

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (with `tw-animate-css` for micro-interactions)
- **State Management**: Zustand
- **Backend/DB**: Supabase
- **Data Ingestion**: Garmin Connect Integration (via `garmin-connect`)
- **Visualization**: Recharts

## Features

- **Automated Garmin Sync**: Seamlessly imports activities, sleep, and HRV data.
- **Daily Audit**: A morning check-in system to log subjective metrics (soreness, fueling) that sensors miss.
- **Adaptive Planning**: Automatically suggests modifications (e.g., "Switch to Bike", "BFR Walk") when readiness is low.
- **Visual Analytics**: Interactive dashboard displaying training load, recovery trends, and compliance.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or pnpm
- A Supabase project
- Garmin Connect credentials (for data sync)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MartinT518/APEX-performance.git
    cd APEX-performance
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env.local` file in the root directory and add your credentials:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GARMIN_EMAIL=your_garmin_email
    GARMIN_PASSWORD=your_garmin_password
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## License

All rights reserved.
