/* Payload admin – rot-layout for (payload)-gruppen. Basert på Payloads mal. */
import configPromise from "@payload-config";
import "@payloadcms/next/css";
import type { ServerFunctionClient } from "payload";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import React from "react";
import { importMap } from "./admin/importMap.js";

type Args = { children: React.ReactNode };

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({ ...args, config: configPromise, importMap });
};

const Layout = ({ children }: Args) => (
  <RootLayout
    config={configPromise}
    importMap={importMap}
    serverFunction={serverFunction}
  >
    {children}
  </RootLayout>
);

export default Layout;
