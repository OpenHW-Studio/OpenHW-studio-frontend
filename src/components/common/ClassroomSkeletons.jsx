export function ClassCardSkeleton({ count = 4 }) {
  return Array.from({ length: count }).map((_, i) => (
    <article key={`class-skeleton-${i}`} className="teacher-class-card teacher-class-card--skeleton" aria-hidden="true">
      <div className="teacher-skeleton teacher-skeleton--banner" />
      <div className="teacher-class-card__body">
        <div className="teacher-skeleton teacher-skeleton--copy" />
        <div className="teacher-skeleton teacher-skeleton--avatar" />
      </div>
    </article>
  ))
}

export function StreamCardSkeleton({ count = 3 }) {
  return Array.from({ length: count }).map((_, i) => (
    <article key={`stream-skeleton-${i}`} className="teacher-stream-card teacher-stream-card--skeleton" aria-hidden="true">
      <header className="teacher-stream-card__header">
        <div className="teacher-stream-card__author">
          <div className="teacher-skeleton teacher-skeleton--avatar" />
          <div style={{ flex: 1 }}>
            <div className="teacher-skeleton teacher-skeleton--line" style={{ width: '40%' }} />
            <div className="teacher-skeleton teacher-skeleton--line" style={{ width: '25%', marginTop: 6 }} />
          </div>
        </div>
      </header>
      <div className="teacher-stream-card__body">
        <div className="teacher-skeleton teacher-skeleton--line" />
        <div className="teacher-skeleton teacher-skeleton--line" style={{ width: '70%', marginTop: 8 }} />
      </div>
    </article>
  ))
}

export function ClassDetailSkeleton() {
  return (
    <div className="teacher-dashboard-page">
      <aside className="teacher-sidebar teacher-sidebar--fixed">
        <div className="teacher-sidebar__brand">
          <span className="teacher-sidebar__brand-mark">OH</span>
          <div>
            <p className="teacher-sidebar__eyebrow">OpenHW</p>
            <h1 className="teacher-sidebar__title">Studio</h1>
          </div>
        </div>
      </aside>

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-class-page teacher-class-page--shell">
          <header className="teacher-class-hero teacher-class-hero--skeleton" aria-hidden="true">
            <div className="teacher-skeleton teacher-skeleton--hero" />
          </header>

          <nav className="teacher-class-tabs" aria-hidden="true">
            <div className="teacher-skeleton teacher-skeleton--tab" />
            <div className="teacher-skeleton teacher-skeleton--tab" />
            <div className="teacher-skeleton teacher-skeleton--tab" />
          </nav>

          <div className="teacher-class-layout">
            <section className="teacher-class-main">
              <section className="teacher-list-block" aria-hidden="true">
                <div className="teacher-skeleton teacher-skeleton--line" />
                <div className="teacher-skeleton teacher-skeleton--activity" />
                <div className="teacher-skeleton teacher-skeleton--activity" />
                <div className="teacher-skeleton teacher-skeleton--activity" />
              </section>
            </section>

            <aside className="teacher-class-right" aria-hidden="true">
              <section className="teacher-detail-card">
                <div className="teacher-skeleton teacher-skeleton--line" />
                <div className="teacher-skeleton teacher-skeleton--line" />
              </section>
            </aside>
          </div>
        </section>
      </main>
    </div>
  )
}
