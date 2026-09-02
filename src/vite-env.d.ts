/// <reference types="vite/client" />

// The shared UI package ships JavaScript without type declarations, so this
// describes the two pieces this app uses rather than letting the import fall
// through to `any`.
declare module '@ff8-speedruns/ui' {
  import type { ReactNode } from 'react';

  export interface ToolShellProps {
    title: string;
    status?: 'needsTesters' | 'stable' | 'experimental';
    repo?: string;
    intro?: ReactNode;
    credits?: ReactNode;
    children?: ReactNode;
  }

  export function ToolShell(props: ToolShellProps): JSX.Element;
  export function FF8Provider(props: { children?: ReactNode }): JSX.Element;
}

declare module '@ff8-speedruns/ui/styles.css';
