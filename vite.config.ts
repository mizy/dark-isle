import { defineConfig } from 'vite';

export default defineConfig({
  base: "./",
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: "./index.html",
        debug: "./debug.html",
      },
    },
  },
});
