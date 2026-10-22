# Events Feature

This folder contains reusable event-related components for the Entrust Africa platform.

## Components
- `EventCard`: Displays a single event with title, description, location, date, highlights, images, and CTA.
- `EventList`: Renders a list of events using `EventCard`.

## Usage
Import and use these components in any page or feature that needs to display events:

```tsx
import { EventCard, EventList } from "@/app/features/events";
```

## Extend
- Add registration forms, RSVP, or event filtering as needed.
- Keep all event-related UI and logic in this folder for maintainability.
