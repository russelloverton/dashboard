'use client';

import React from 'react';

/**
 * Error boundary that wraps each widget.
 * If a widget crashes, shows a clean error state
 * instead of crashing the entire dashboard.
 */
export class WidgetErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[${this.props.name || 'Widget'}] Error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="widget widget-error">
          <div className="widget-error-icon">⚠️</div>
          <div className="widget-error-title">{this.props.name || 'Widget'}</div>
          <div className="widget-error-message">
            {this.state.error?.message || 'Something went wrong'}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
