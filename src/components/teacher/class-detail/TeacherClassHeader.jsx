import { MoreVertical } from "lucide-react";
import { tabs } from "./helpers.js";

export default function TeacherClassHeader({
  classroom,
  activeTab,
  onTabChange,
  classMenuRef,
  showClassMenu,
  onToggleClassMenu,
  onOpenEditModal,
  onDeleteClass,
  deletingClass,
}) {
  return (
    <>
      <header
        className="teacher-class-hero"
        style={
          classroom.image
            ? { backgroundImage: `url(${classroom.image})` }
            : undefined
        }
      >
        <div className="teacher-class-hero__overlay" />
        <div className="teacher-class-hero__actions" ref={classMenuRef}>
          <button
            type="button"
            className="teacher-class-hero__menu"
            onClick={onToggleClassMenu}
            aria-label="Open class actions"
            aria-expanded={showClassMenu}
          >
            <MoreVertical size={16} />
          </button>

          {showClassMenu && (
            <div className="teacher-class-hero__menu-list">
              <button type="button" onClick={onOpenEditModal}>
                Edit class details
              </button>
              <button
                type="button"
                onClick={onDeleteClass}
                disabled={deletingClass}
              >
                {deletingClass ? "Deleting class..." : "Delete class"}
              </button>
            </div>
          )}
        </div>

        <div className="teacher-class-hero__content">
          <h1>{classroom.name}</h1>
          <p>{classroom.bio || "Class detail and announcements"}</p>
        </div>
      </header>

      <nav className="teacher-class-tabs" aria-label="Classroom sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`teacher-class-tabs__item${activeTab === tab.key ? " is-active" : ""}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  );
}
