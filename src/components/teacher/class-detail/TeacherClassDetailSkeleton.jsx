import ClassroomSidebar from "../../common/ClassroomSidebar.jsx";

export default function TeacherClassDetailSkeleton({
  navLinks,
  user,
  onLogout,
}) {
  return (
    <div className="teacher-dashboard-page">
      <ClassroomSidebar links={navLinks} user={user} onLogout={onLogout} />
      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-class-page teacher-class-page--shell">
          <header
            className="teacher-class-hero teacher-class-hero--skeleton"
            aria-hidden="true"
          >
            <div className="teacher-skeleton teacher-skeleton--hero" />
          </header>
          <nav className="teacher-class-tabs" aria-hidden="true">
            <div className="teacher-skeleton teacher-skeleton--tab" />
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
  );
}
