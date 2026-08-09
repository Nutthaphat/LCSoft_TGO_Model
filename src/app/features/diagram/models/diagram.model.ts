import { Edge, Node } from '@swimlane/ngx-graph';
import { Equipment, ProcessStream } from '../../../models/domain.model';

export type DiagramNodeKind = 'stream' | 'equipment';

export interface DiagramNodeData {
  kind: DiagramNodeKind;
  /** Process (material/energy) CO₂e used for primary display. */
  processCarbonKg: number;
  /** Transportation CO₂e for streams; 0 for equipment. */
  transportCarbonKg: number;
  /** Combined CO₂e used for coloring / filters (process + transport). */
  carbonFootprintKg: number;
  color: string;
  isHighCarbon: boolean;
  isMatch: boolean;
  isSelected: boolean;
  stream?: ProcessStream;
  equipment?: Equipment;
  subtitle: string;
}

export interface DiagramNode extends Node {
  data: DiagramNodeData;
}

export interface DiagramEdge extends Edge {
  data?: {
    carbonFootprintKg: number;
    color: string;
  };
}

export interface DiagramGraph {
  nodes: DiagramNode[];
  links: DiagramEdge[];
}

export interface DiagramFilters {
  search: string;
  showStreams: boolean;
  showEquipment: boolean;
  highCarbonOnly: boolean;
  minCarbonKg: number;
}

export const DEFAULT_DIAGRAM_FILTERS: DiagramFilters = {
  search: '',
  showStreams: true,
  showEquipment: true,
  highCarbonOnly: false,
  minCarbonKg: 0,
};
