declare module 'd3-force' {
    export function forceSimulation<N = any, L = any>(nodes?: N[]): any
    export function forceLink<N = any, L = any>(links?: L[]): any
    export function forceManyBody<N = any, L = any>(): any
    export function forceCenter<N = any, L = any>(x?: number, y?: number): any
    export function forceCollide<N = any, L = any>(radius?: number): any
    export type Simulation<N = any, L = any> = any
    export type SimulationNodeDatum = any
    export type SimulationLinkDatum<N> = any
}
