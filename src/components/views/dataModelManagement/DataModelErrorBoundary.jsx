// src/components/views/dataModelManagement/DataModelErrorBoundary.jsx
"use client";

import React from 'react';
import { AlertTriangle } from 'lucide-react';

class DataModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, resetN: 0 };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Data model component error:', error, errorInfo);
  }
  reset = () => this.setState(s => ({ hasError: false, error: null, resetN: s.resetN + 1 }));
  render() {
    if (this.state.hasError) {
      return (
        <div className="surface border border-error rounded-lg p-4">
          <div className="flex items-center gap-2 text-error mb-2">
            <AlertTriangle size={20} />
            <h3 className="font-medium">Data Model Display Error</h3>
          </div>
          <p className="text-theme-secondary text-sm">
            There was an error displaying this data model. Please try refreshing the page.
          </p>
          <button onClick={this.reset} className="mt-2 px-3 py-1 btn-primary text-sm">Retry</button>
        </div>
      );
    }
    // key forces remount on Retry
    return <div key={this.state.resetN}>{this.props.children}</div>;
  }
}

export default DataModelErrorBoundary;
