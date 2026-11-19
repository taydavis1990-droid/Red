export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsConfig {
  quality: GraphicsQuality;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  maxPixelRatio: number;
  textureAnisotropy: number;
  hemisphereLightIntensity: number;
  directionalLightIntensity: number;
  toneMappingExposure: number;
}

const PROFILES: Record<GraphicsQuality, GraphicsConfig> = {
  low: {
    quality: 'low',
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    maxPixelRatio: 0.85,
    textureAnisotropy: 1,
    hemisphereLightIntensity: 1.35,
    directionalLightIntensity: 1.8,
    toneMappingExposure: 1.05,
  },
  medium: {
    quality: 'medium',
    antialias: false,
    shadows: false,
    shadowMapSize: 1024,
    maxPixelRatio: 1,
    textureAnisotropy: 2,
    hemisphereLightIntensity: 1.5,
    directionalLightIntensity: 1.95,
    toneMappingExposure: 1.05,
  },
  high: {
    quality: 'high',
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    maxPixelRatio: 1.35,
    textureAnisotropy: 4,
    hemisphereLightIntensity: 1.65,
    directionalLightIntensity: 2.15,
    toneMappingExposure: 1.05,
  },
  ultra: {
    quality: 'ultra',
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    maxPixelRatio: 1.75,
    textureAnisotropy: 8,
    hemisphereLightIntensity: 1.75,
    directionalLightIntensity: 2.3,
    toneMappingExposure: 1.05,
  },
};

export function isGraphicsQuality(value: string): value is GraphicsQuality {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'ultra';
}

export function getGraphicsConfig(quality: GraphicsQuality): GraphicsConfig {
  return { ...PROFILES[quality] };
}

export function selectGraphicsConfig(): GraphicsConfig {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const constrained = cores <= 2 || (deviceMemory !== undefined && deviceMemory <= 2);
  const mediumDevice = cores <= 4 || (deviceMemory !== undefined && deviceMemory <= 4);
  const quality: GraphicsQuality = constrained
    ? 'low'
    : coarsePointer || mediumDevice
      ? 'medium'
      : cores >= 8 && deviceMemory !== undefined && deviceMemory >= 8
        ? 'ultra'
        : 'high';
  return getGraphicsConfig(quality);
}
