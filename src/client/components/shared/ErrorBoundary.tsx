import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState } from "./ErrorState.js";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level boundary that prevents a render-time exception in any
 * descendant from blanking the entire UI. Engineers see the failure
 * inline with a retry button instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Render error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <ErrorState
            title="Unexpected error"
            error={this.state.error}
            onRetry={this.reset}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
