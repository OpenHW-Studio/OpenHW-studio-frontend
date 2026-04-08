import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, FileText, Link2, NotebookPen, X } from "lucide-react";
import ClassroomAttachmentBlock from "../../common/ClassroomAttachmentBlock.jsx";
import { formatDateTime } from "../../common/test.js";
import { pickAttachments, pickLinks } from "./helpers.js";

export default function TeacherAssignmentSubmissionsModal({
  assignment,
  classroomName,
  submissionsState,
  onClose,
  onPreviewFile,
}) {
  const submissions = submissionsState.data?.submissions || [];
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");

  useEffect(() => {
    if (!submissions.length) {
      setSelectedSubmissionId("");
      return;
    }

    const hasSelectedSubmission = submissions.some(
      (submission) => submission._id === selectedSubmissionId
    );

    if (!hasSelectedSubmission) {
      setSelectedSubmissionId(submissions[0]._id);
    }
  }, [selectedSubmissionId, submissions]);

  const selectedSubmission = useMemo(
    () =>
      submissions.find((submission) => submission._id === selectedSubmissionId) ||
      submissions[0] ||
      null,
    [selectedSubmissionId, submissions]
  );
  const selectedSubmissionLinks = selectedSubmission ? pickLinks(selectedSubmission) : [];
  const selectedSubmissionFiles = selectedSubmission ? pickAttachments(selectedSubmission) : [];

  if (!assignment) return null;

  return (
    <div className="teacher-modal" role="dialog" aria-modal="true" aria-label="Assignment submissions">
      <div className="teacher-modal__backdrop" onClick={onClose} />
      <section className="teacher-modal__content teacher-assignment-modal teacher-assignment-modal--teacher" onClick={(event) => event.stopPropagation()}>
        <header className="teacher-modal__header">
          <div>
            <div className="teacher-assignment-modal__crumbs teacher-assignment-modal__crumbs--teacher">
              <span>{classroomName || "Classroom"}</span>
              <ChevronRight size={14} />
              <span>Classwork</span>
            </div>
            <h3>{assignment.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </header>

        <div className="teacher-assignment-modal__meta">
          <span>{assignment.dueDate ? `Due ${formatDateTime(assignment.dueDate)}` : `Posted ${formatDateTime(assignment.createdAt)}`}</span>
          {submissionsState.data?.stats ? (
            <span>
              {submissionsState.data.stats.submittedCount}/{submissionsState.data.stats.classStudentCount} submitted
            </span>
          ) : null}
        </div>

        {submissionsState.loading ? (
          <p className="teacher-inline-state">Loading submissions...</p>
        ) : null}

        {submissionsState.error ? (
          <p className="teacher-inline-state teacher-inline-state--error">{submissionsState.error}</p>
        ) : null}

        {!submissionsState.loading && !submissionsState.error ? (
          <div className="teacher-assignment-modal__review-layout">
            {submissions.length ? (
              <>
                <aside className="teacher-assignment-modal__review-sidebar">
                  <div className="teacher-assignment-modal__review-sidebar-head">
                    <h4>Student Submissions</h4>
                    <span>{submissions.length} total</span>
                  </div>

                  <div className="teacher-review-student-list">
                    {submissions.map((submission) => {
                      const attachmentCount =
                        submission.attachments?.length || submission.files?.length || 0;
                      const linkCount = pickLinks(submission).length;
                      const studentInitials = submission.studentId?.name
                        ? submission.studentId.name
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()
                        : "S";

                      return (
                        <button
                          key={submission._id}
                          type="button"
                          className={`teacher-review-student-item${
                            submission._id === selectedSubmission?._id ? " is-active" : ""
                          }`}
                          onClick={() => setSelectedSubmissionId(submission._id)}
                        >
                          <div className="teacher-review-student-item__identity">
                            <div className="teacher-notice-card__avatar">{studentInitials}</div>
                            <div className="teacher-review-student-item__copy">
                              <strong>{submission.studentId?.name || "Student"}</strong>
                              <small>{submission.studentId?.email || "No email"}</small>
                            </div>
                          </div>

                          <div className="teacher-review-student-item__meta">
                            <span>Updated {formatDateTime(submission.updatedAt)}</span>
                            <span>{attachmentCount} files</span>
                            <span>{linkCount} links</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <section className="teacher-assignment-modal__review-detail">
                  {selectedSubmission ? (
                    <>
                      <div className="teacher-assignment-modal__review-detail-head">
                        <div className="teacher-submission-item__left">
                          <div className="teacher-notice-card__avatar">
                            {selectedSubmission.studentId?.name
                              ? selectedSubmission.studentId.name
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join("")
                                  .toUpperCase()
                              : "S"}
                          </div>
                          <div>
                            <strong>{selectedSubmission.studentId?.name || "Student"}</strong>
                            <small>{selectedSubmission.studentId?.email || "No email"}</small>
                          </div>
                        </div>

                        <div className="teacher-review-detail__stats">
                          <span>Updated {formatDateTime(selectedSubmission.updatedAt)}</span>
                          <span>
                            {(selectedSubmission.attachments?.length ||
                              selectedSubmission.files?.length ||
                              0)}{" "}
                            files
                          </span>
                          <span>{selectedSubmissionLinks.length} links</span>
                        </div>
                      </div>

                      <div className="teacher-assignment-modal__review-detail-body">
                        <div className="teacher-assignment-modal__section">
                          <h4>Submission Notes</h4>
                          <p className="teacher-submission-item__note">
                            {selectedSubmission.notes || "No notes added."}
                          </p>
                        </div>

                        <div className="teacher-assignment-modal__section">
                          <h4>Links</h4>
                          {selectedSubmissionLinks.length > 0 ? (
                            <div className="teacher-assignment-modal__links">
                              {selectedSubmissionLinks.map((link, idx) => (
                                <a
                                  key={`${selectedSubmission._id}-link-${idx}`}
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="teacher-assignment-modal__link"
                                >
                                  <span>
                                    <Link2 size={14} />
                                    {link}
                                  </span>
                                  <ExternalLink size={14} />
                                </a>
                              ))}
                            </div>
                          ) : (
                            <div className="teacher-review-empty">
                              <Link2 size={16} />
                              <span>No links submitted.</span>
                            </div>
                          )}
                        </div>

                        <div className="teacher-assignment-modal__section">
                          <h4>Files</h4>
                          {selectedSubmissionFiles.length > 0 ? (
                            <ClassroomAttachmentBlock
                              source={selectedSubmission}
                              wrapperClassName="classroom-files--submission teacher-review-files"
                              onPreviewFile={onPreviewFile}
                            />
                          ) : (
                            <div className="teacher-review-empty">
                              <FileText size={16} />
                              <span>No files submitted.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}
                </section>
              </>
            ) : (
              <div className="teacher-review-empty-state">
                <div className="teacher-review-empty-state__icon">
                  <NotebookPen size={24} />
                </div>
                <strong>No student solutions yet.</strong>
                <p>Submissions will appear here once students start turning in their work.</p>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
