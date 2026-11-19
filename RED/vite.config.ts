import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/examples/jsm/')) return 'three-addons';
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/@dimforge/rapier3d-compat/')) return 'rapier';
        },
      },
    },
  },
});
