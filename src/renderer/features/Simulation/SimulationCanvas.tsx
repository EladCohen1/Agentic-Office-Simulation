import { useEffect, useRef } from 'react';

import { mountSimulationStage } from './simulation-stage';

export function SimulationCanvas() {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return;
        }

        return mountSimulationStage(host);
    }, []);

    return <div ref={hostRef} className="simulation-canvas" />;
}
