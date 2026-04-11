import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { boneyardPlugin } from "boneyard-js/vite";
import { nitro } from "nitro/vite";
import type { PluginOption } from "vite";

export function createAppPlugins({
  isTest,
}: {
  isTest: boolean;
}): PluginOption[] {
  const plugins: PluginOption[] = [
    tanstackStart({ srcDirectory: "src" }),
    viteReact(),
    tailwindcss(),
  ];

  if (!isTest) {
    plugins.splice(1, 0, nitro({ preset: "vercel" }));
    plugins.push(boneyardPlugin());
  }

  return plugins;
}
