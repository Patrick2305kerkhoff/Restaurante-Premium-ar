/// <reference types="vite/client" />
import type React from "react";
type ModelViewerProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;
declare module "react" {
  namespace JSX {
    interface IntrinsicElements { "model-viewer": ModelViewerProps }
  }
}
