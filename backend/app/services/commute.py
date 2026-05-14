from app.models.commute import CommuteEstimate
from app.models.common import TransportMode


class CommuteService:
    async def estimate(self, origin_name: str, destination: str, modes: list[str] | None = None) -> list[CommuteEstimate]:
        selected = [TransportMode(mode) for mode in modes] if modes else [TransportMode.metro, TransportMode.uber, TransportMode.bus]
        baseline = {
            TransportMode.metro: (28, 1800, 82, 8),
            TransportMode.bus: (42, 1200, 62, 18),
            TransportMode.walking: (75, 0, 92, 0),
            TransportMode.rapido: (26, 3200, 68, 15),
            TransportMode.uber: (24, 7200, 64, 20),
            TransportMode.ola: (25, 7000, 63, 20),
            TransportMode.cityflow: (38, 2200, 70, 14),
            TransportMode.hexa: (34, 2600, 72, 12),
        }
        return [
            CommuteEstimate(
                mode=mode,
                minutes=baseline[mode][0],
                monthly_cost=baseline[mode][1],
                reliability_score=baseline[mode][2],
                peak_delay_minutes=baseline[mode][3],
                route_summary=f"Estimated {mode.value} commute from {origin_name} to {destination}.",
            )
            for mode in selected
        ]
