import type { RouteIndex } from '../domain/route';
import generated from './routes.generated.json';

export const routes = generated as unknown as RouteIndex;
