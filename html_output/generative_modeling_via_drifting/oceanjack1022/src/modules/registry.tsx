import React from 'react';
import {
  DriftCoverOld, DriftCoverNew, DriftSteps, DriftPushforward, DriftField,
} from './driftScenesA';
import {
  DriftAntiSymmetry, DriftTrainStep, DriftFeature, DriftCfg,
} from './driftScenesB';
import {
  DriftArchitecture, DriftBudget, DriftSampling, DriftDomains, DriftLimits, DriftRecap,
} from './driftScenesC';

export interface WidgetProps { chapterId: string; moduleId: string }

export const widgetRegistry: Record<string, React.FC<WidgetProps>> = {
  driftCoverOld: DriftCoverOld,
  driftCoverNew: DriftCoverNew,
  driftSteps: DriftSteps,
  driftPushforward: DriftPushforward,
  driftField: DriftField,
  driftAntiSymmetry: DriftAntiSymmetry,
  driftTrainStep: DriftTrainStep,
  driftFeature: DriftFeature,
  driftCfg: DriftCfg,
  driftArchitecture: DriftArchitecture,
  driftBudget: DriftBudget,
  driftSampling: DriftSampling,
  driftDomains: DriftDomains,
  driftLimits: DriftLimits,
  driftRecap: DriftRecap,
};
