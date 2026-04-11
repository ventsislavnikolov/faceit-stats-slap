import React from "react";
import { vi } from "vitest";

vi.mock("boneyard-js/react", () => ({
  Skeleton: ({
    loading,
    children,
    fallback,
    name: _name,
    ...props
  }: {
    loading: boolean;
    children?: React.ReactNode;
    fallback?: React.ReactNode;
    name: string;
    [key: string]: unknown;
  }) =>
    loading
      ? React.createElement(
          React.Fragment,
          null,
          fallback ?? React.createElement("div", props)
        )
      : React.createElement(React.Fragment, null, children),
}));
