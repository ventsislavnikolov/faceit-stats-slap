import React from "react";
import { vi } from "vitest";

vi.mock("boneyard-js/react", () => ({
  Skeleton: ({
    loading,
    children,
    name: _name,
    ...props
  }: {
    loading: boolean;
    children?: React.ReactNode;
    name: string;
    [key: string]: unknown;
  }) =>
    loading
      ? React.createElement("div", props)
      : React.createElement(React.Fragment, null, children),
}));
