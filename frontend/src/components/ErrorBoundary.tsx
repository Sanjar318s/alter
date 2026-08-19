"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center px-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-wide text-magenta mb-2">Ошибка</p>
          <h1 className="font-display font-extrabold text-[28px] mb-3">Что-то пошло не так</h1>
          <p className="text-[13px] text-ink-70 max-w-md mb-6">
            {this.state.error.message || "Не удалось отрисовать страницу."}
          </p>
          <button
            type="button"
            className="px-4 py-2 border border-line text-[13px] bg-transparent text-paper hover:border-magenta"
            onClick={() => this.setState({ error: null })}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
