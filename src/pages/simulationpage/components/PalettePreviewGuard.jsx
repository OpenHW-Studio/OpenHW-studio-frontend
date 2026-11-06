import React from 'react';

/**
 * PalettePreviewGuard — error boundary around a single palette preview.
 *
 * Dynamic/backend-injected UIs run untrusted-ish transpiled code; if one
 * throws during render (stale cache, context misuse, hook violation), React
 * would unmount the ENTIRE SimulatorPage tree. This boundary isolates the
 * failure to that one 84×66 preview cell and shows the fallback box icon.
 */
export class PalettePreviewGuard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Palette] preview for "${this.props.type}" crashed, showing fallback:`, error?.message || error);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.type !== this.props.type && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback || null;
    return this.props.children;
  }
}
