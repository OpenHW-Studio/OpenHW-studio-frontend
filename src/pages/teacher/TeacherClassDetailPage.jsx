import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import ClassroomSidebar from "../../components/common/ClassroomSidebar.jsx";
import { getAvatarLetters } from "../../components/common/test.js";
import TeacherClassDetailSkeleton from "../../components/teacher/class-detail/TeacherClassDetailSkeleton.jsx";
import TeacherClassHeader from "../../components/teacher/class-detail/TeacherClassHeader.jsx";
import TeacherClassMainContent from "../../components/teacher/class-detail/TeacherClassMainContent.jsx";
import TeacherClassSidebar from "../../components/teacher/class-detail/TeacherClassSidebar.jsx";
import TeacherComposerModal from "../../components/teacher/class-detail/TeacherComposerModal.jsx";
import TeacherEditClassModal from "../../components/teacher/class-detail/TeacherEditClassModal.jsx";
import { sidebarLinks } from "../../components/teacher/class-detail/helpers.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  createClassAssignment,
  createClassNotice,
  deleteClassAssignment,
  deleteClassNotice,
  deleteClassroom,
  getAssignmentSubmissions,
  getClassAssignments,
  getClassroomById,
  getClassroomNotices,
  getClassroomStudents,
  removeClassroomStudent,
  updateClassroom,
} from "../../services/classroomService.js";

export default function TeacherClassDetailPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [classroom, setClassroom] = useState(null);
  const [notices, setNotices] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);

  const [noticeInput, setNoticeInput] = useState("");
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    message: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    dueDate: "",
  });

  const [noticeFiles, setNoticeFiles] = useState("");
  const [assignmentLinks, setAssignmentLinks] = useState([]);
  const [assignmentLinkInput, setAssignmentLinkInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [postingNotice, setPostingNotice] = useState(false);
  const [postingAssignment, setPostingAssignment] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [activeTab, setActiveTab] = useState("stream");
  const [showComposer, setShowComposer] = useState(false);
  const [composerMode, setComposerMode] = useState("assignment");

  const [showClassMenu, setShowClassMenu] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updatingClass, setUpdatingClass] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    image: "",
  });

  const [activeAssignmentId, setActiveAssignmentId] = useState(null);
  const [submissionsState, setSubmissionsState] = useState({
    loading: false,
    error: "",
    data: null,
  });
  const [assignmentMetrics, setAssignmentMetrics] = useState({});
  const [showCodeMenu, setShowCodeMenu] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");

  const classMenuRef = useRef(null);
  const codeMenuRef = useRef(null);

  const avatarInitials = useMemo(
    () => getAvatarLetters(user?.name, "T"),
    [user],
  );

  const markStats = useMemo(() => {
    const withDueDate = assignments.filter((item) => item.dueDate);
    const upcoming = withDueDate.filter(
      (item) => new Date(item.dueDate).getTime() >= Date.now(),
    );
    const closed = withDueDate.filter(
      (item) => new Date(item.dueDate).getTime() < Date.now(),
    );

    return {
      total: assignments.length,
      upcoming: upcoming.length,
      closed: closed.length,
      noDueDate: assignments.length - withDueDate.length,
    };
  }, [assignments]);

  const streamItems = useMemo(() => {
    const noticeItems = notices.map((notice) => ({
      id: notice._id,
      type: "notice",
      title: notice.title || "Class notice",
      body: notice.message,
      createdAt: notice.createdAt,
      createdBy: notice.createdBy,
      raw: notice,
    }));

    const assignmentItems = assignments.map((assignment) => ({
      id: assignment._id,
      type: "assignment",
      title: assignment.title || "Assignment",
      body: assignment.description || "",
      createdAt: assignment.createdAt || assignment.updatedAt,
      dueDate: assignment.dueDate,
      raw: assignment,
    }));

    return [...assignmentItems, ...noticeItems].sort((a, b) => {
      const left = new Date(a.createdAt || 0).getTime();
      const right = new Date(b.createdAt || 0).getTime();
      return right - left;
    });
  }, [assignments, notices]);

  useEffect(() => {
    if (!info) return undefined;

    const timeoutId = setTimeout(() => {
      setInfo("");
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [info]);

  useEffect(() => {
    const loadDetailData = async () => {
      if (!classId) return;

      setLoading(true);
      setError("");

      try {
        const classData = await getClassroomById(classId);
        setClassroom(classData);

        const [noticesResponse, assignmentsResponse, studentsResponse] =
          await Promise.all([
            getClassroomNotices(classId),
            getClassAssignments(classId),
            getClassroomStudents(classId),
          ]);

        setNotices(noticesResponse);
        setAssignments(assignmentsResponse);
        setStudents(studentsResponse);
      } catch (detailError) {
        setError(detailError.message || "Failed to load class details");
      } finally {
        setLoading(false);
      }
    };

    loadDetailData();
  }, [classId]);

  useEffect(() => {
    if (!showComposer) return undefined;

    const onEsc = (event) => {
      if (event.key === "Escape") {
        setShowComposer(false);
      }
    };

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [showComposer]);

  useEffect(() => {
    if (!showClassMenu && !showCodeMenu) return undefined;

    const onPointerDown = (event) => {
      if (!classMenuRef.current?.contains(event.target)) {
        setShowClassMenu(false);
      }

      if (!codeMenuRef.current?.contains(event.target)) {
        setShowCodeMenu(false);
      }
    };

    const onEsc = (event) => {
      if (event.key === "Escape") {
        setShowClassMenu(false);
        setShowCodeMenu(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEsc);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [showClassMenu, showCodeMenu]);

  useEffect(() => {
    let cancelled = false;

    const loadAssignmentMetrics = async () => {
      if (!classId || assignments.length === 0) {
        setAssignmentMetrics({});
        return;
      }

      const entries = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            const response = await getAssignmentSubmissions(
              classId,
              assignment._id,
            );
            return [
              assignment._id,
              response?.stats || {
                submittedCount: 0,
                classStudentCount: students.length || 0,
              },
            ];
          } catch {
            return [
              assignment._id,
              { submittedCount: 0, classStudentCount: students.length || 0 },
            ];
          }
        }),
      );

      if (!cancelled) {
        setAssignmentMetrics(Object.fromEntries(entries));
      }
    };

    loadAssignmentMetrics();

    return () => {
      cancelled = true;
    };
  }, [classId, assignments, students.length]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navLinks = sidebarLinks.map((item) => ({
    ...item,
    isActive: item.key === "classes",
    onClick: () => {
      if (item.route) navigate(item.route);
    },
  }));

  const handlePostNotice = async (event) => {
    event.preventDefault();

    if (!noticeInput.trim()) return;

    setPostingNotice(true);
    setError("");

    const attachments = noticeFiles
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await createClassNotice(classId, {
        title: "Class Update",
        message: noticeInput,
        attachments,
      });
      setNoticeInput("");
      setNoticeFiles("");
      setNotices(await getClassroomNotices(classId));
      setShowComposer(false);
    } catch (postError) {
      setError(postError.message || "Failed to post notice");
    } finally {
      setPostingNotice(false);
    }
  };

  const handleNoticeComposerInput = (event) => {
    setNoticeForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleCreateNoticeFromComposer = async (event) => {
    event.preventDefault();

    if (!noticeForm.message.trim()) return;

    setPostingNotice(true);
    setError("");

    const attachments = noticeFiles
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await createClassNotice(classId, {
        title: noticeForm.title || "Class Update",
        message: noticeForm.message,
        attachments,
      });
      setNoticeForm({ title: "", message: "" });
      setNoticeFiles("");
      setNotices(await getClassroomNotices(classId));
      setShowComposer(false);
    } catch (postError) {
      setError(postError.message || "Failed to post notice");
    } finally {
      setPostingNotice(false);
    }
  };

  const handleAssignmentInput = (event) => {
    setAssignmentForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleCreateAssignment = async (event) => {
    event.preventDefault();

    if (!assignmentForm.title.trim()) return;

    setPostingAssignment(true);
    setError("");

    const pendingLink = assignmentLinkInput.trim();
    const attachments = [
      ...assignmentLinks.map((link) => link.trim()).filter(Boolean),
      ...(pendingLink ? [pendingLink] : []),
    ];

    try {
      await createClassAssignment(classId, {
        title: assignmentForm.title,
        description: assignmentForm.description,
        dueDate: assignmentForm.dueDate || undefined,
        attachments,
      });

      setAssignmentForm({ title: "", description: "", dueDate: "" });
      setAssignmentLinks([]);
      setAssignmentLinkInput("");
      setAssignments(await getClassAssignments(classId));
      setShowComposer(false);
      setActiveTab("classwork");
    } catch (assignmentError) {
      setError(assignmentError.message || "Failed to create assignment");
    } finally {
      setPostingAssignment(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    try {
      await deleteClassNotice(classId, noticeId);
      setNotices(await getClassroomNotices(classId));
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete notice");
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await deleteClassAssignment(classId, assignmentId);
      const refreshedAssignments = await getClassAssignments(classId);
      setAssignments(refreshedAssignments);

      if (activeAssignmentId === assignmentId) {
        setActiveAssignmentId(null);
        setSubmissionsState({ loading: false, error: "", data: null });
      }
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete assignment");
    }
  };

  const handleAddAssignmentLink = () => {
    const normalizedLink = assignmentLinkInput.trim();
    if (!normalizedLink) return;

    setAssignmentLinks((current) => [...current, normalizedLink]);
    setAssignmentLinkInput("");
  };

  const handleRemoveAssignmentLink = (index) => {
    setAssignmentLinks((current) => current.filter((_, idx) => idx !== index));
  };

  const handleDeleteClass = async () => {
    const shouldDelete = window.confirm(
      "Delete this class and all assignments/notices?",
    );
    if (!shouldDelete) return;

    setDeletingClass(true);

    try {
      await deleteClassroom(classId);
      navigate("/teacher/dashboard");
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete class");
    } finally {
      setDeletingClass(false);
    }
  };

  const openEditModal = () => {
    setShowClassMenu(false);
    setEditError("");
    setEditForm({
      name: classroom?.name || "",
      bio: classroom?.bio || "",
      image: classroom?.image || "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditInput = (event) => {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleUpdateClassroom = async (event) => {
    event.preventDefault();

    if (!editForm.name.trim()) {
      setEditError("Class name is required");
      return;
    }

    setUpdatingClass(true);
    setEditError("");

    try {
      const updated = await updateClassroom(classId, {
        name: editForm.name,
        bio: editForm.bio,
        image: editForm.image,
      });
      setClassroom(updated);
      setIsEditModalOpen(false);
      setInfo("Class details updated successfully.");
    } catch (updateError) {
      setEditError(updateError.message || "Failed to update classroom");
    } finally {
      setUpdatingClass(false);
    }
  };

  const handleSelectAssignment = async (assignmentId) => {
    if (activeAssignmentId === assignmentId) {
      setActiveAssignmentId(null);
      setSubmissionsState({ loading: false, error: "", data: null });
      return;
    }

    setActiveAssignmentId(assignmentId);
    setSubmissionsState({ loading: true, error: "", data: null });

    try {
      const response = await getAssignmentSubmissions(classId, assignmentId);
      setSubmissionsState({ loading: false, error: "", data: response });
    } catch (submissionError) {
      setSubmissionsState({
        loading: false,
        error: submissionError.message || "Failed to load submissions",
        data: null,
      });
    }
  };

  const handleRemoveStudent = async (studentId) => {
    const shouldRemove = window.confirm("Remove this student from the class?");
    if (!shouldRemove) return;

    try {
      const updatedStudents = await removeClassroomStudent(classId, studentId);
      setStudents(updatedStudents);
      setInfo("Student removed from class.");
    } catch (removeError) {
      setError(removeError.message || "Failed to remove student");
    }
  };

  const handleShareClass = async () => {
    if (!classroom) return;

    const joinUrl = `${window.location.origin}/student/dashboard?joinCode=${encodeURIComponent(classroom.joinCode)}`;
    const shareText = `Join ${classroom.name} using class code: ${classroom.joinCode}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${classroom.name} Class Invite`,
          text: shareText,
          url: joinUrl,
        });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${joinUrl}`);
      }

      setInfo("Class invite copied/shared successfully.");
      setShowCodeMenu(false);
    } catch (shareError) {
      setError(shareError.message || "Failed to share class invite");
    }
  };

  const handleCopyClassCode = async () => {
    if (!classroom?.joinCode) return;

    try {
      await navigator.clipboard.writeText(classroom.joinCode);
      setInfo("Class code copied.");
      setShowCodeMenu(false);
    } catch (copyError) {
      setError(copyError.message || "Failed to copy class code");
    }
  };

  const handleOpenLiveMeeting = () => {
    const liveMeetingUrl = `${window.location.origin}/simulator?classId=${encodeURIComponent(classId)}&liveMeeting=1`;
    window.open(liveMeetingUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <TeacherClassDetailSkeleton
        navLinks={navLinks}
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  if (!classroom) {
    return (
      <div className="teacher-class-page">
        <p className="teacher-inline-state teacher-inline-state--error">
          {error || "Class not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard-page">
      <ClassroomSidebar links={navLinks} user={user} onLogout={handleLogout} />

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-class-page teacher-class-page--shell">
          <TeacherClassHeader
            classroom={classroom}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            classMenuRef={classMenuRef}
            showClassMenu={showClassMenu}
            onToggleClassMenu={() =>
              setShowClassMenu((currentState) => !currentState)
            }
            onOpenEditModal={openEditModal}
            onDeleteClass={handleDeleteClass}
            deletingClass={deletingClass}
          />

          <div
            className={`teacher-class-layout${activeTab === "stream" ? " is-stream" : ""}`}
          >
            <TeacherClassMainContent
              activeTab={activeTab}
              error={error}
              noticeInput={noticeInput}
              onNoticeInputChange={(event) => setNoticeInput(event.target.value)}
              onPostNotice={handlePostNotice}
              postingNotice={postingNotice}
              avatarInitials={avatarInitials}
              streamItems={streamItems}
              teacherName={user?.name || "Teacher"}
              classId={classId}
              onDeleteNotice={handleDeleteNotice}
              onAssignmentClick={(id) => {
                setActiveTab("classwork");
                handleSelectAssignment(id);
              }}
              assignments={assignments}
              assignmentMetrics={assignmentMetrics}
              studentsCount={students.length}
              activeAssignmentId={activeAssignmentId}
              onSelectAssignment={handleSelectAssignment}
              onDeleteAssignment={handleDeleteAssignment}
              submissionsState={submissionsState}
              classroom={classroom}
              user={user}
              students={students}
              peopleSearch={peopleSearch}
              onPeopleSearchChange={(event) =>
                setPeopleSearch(event.target.value)
              }
              onRemoveStudent={handleRemoveStudent}
              markStats={markStats}
            />

            <TeacherClassSidebar
              codeMenuRef={codeMenuRef}
              showCodeMenu={showCodeMenu}
              onToggleCodeMenu={() =>
                setShowCodeMenu((currentState) => !currentState)
              }
              onCopyClassCode={handleCopyClassCode}
              onShareClass={handleShareClass}
              onOpenLiveMeeting={handleOpenLiveMeeting}
              classroom={classroom}
              assignments={assignments}
            />
          </div>

          <div className="teacher-fab">
            <button
              type="button"
              className="teacher-fab__trigger"
              aria-label="Open class composer"
              onClick={() => {
                setComposerMode(
                  activeTab === "stream" ? "notice" : "assignment",
                );
                setShowComposer(true);
              }}
            >
              <Plus size={20} />
            </button>
          </div>
        </section>
      </main>

      {info ? (
        <div className="teacher-toast" role="status">
          {info}
        </div>
      ) : null}

      {showComposer ? (
        <TeacherComposerModal
          composerMode={composerMode}
          onComposerModeChange={setComposerMode}
          onClose={() => setShowComposer(false)}
          onCreateAssignment={handleCreateAssignment}
          assignmentForm={assignmentForm}
          onAssignmentInputChange={handleAssignmentInput}
          assignmentLinkInput={assignmentLinkInput}
          onAssignmentLinkInputChange={(event) =>
            setAssignmentLinkInput(event.target.value)
          }
          onAddAssignmentLink={handleAddAssignmentLink}
          assignmentLinks={assignmentLinks}
          onRemoveAssignmentLink={handleRemoveAssignmentLink}
          postingAssignment={postingAssignment}
          onCreateNotice={handleCreateNoticeFromComposer}
          noticeForm={noticeForm}
          onNoticeInputChange={handleNoticeComposerInput}
          noticeFiles={noticeFiles}
          onNoticeFilesChange={(event) => setNoticeFiles(event.target.value)}
          postingNotice={postingNotice}
        />
      ) : null}

      {isEditModalOpen ? (
        <TeacherEditClassModal
          editForm={editForm}
          onEditInputChange={handleEditInput}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleUpdateClassroom}
          editError={editError}
          updatingClass={updatingClass}
        />
      ) : null}
    </div>
  );
}
