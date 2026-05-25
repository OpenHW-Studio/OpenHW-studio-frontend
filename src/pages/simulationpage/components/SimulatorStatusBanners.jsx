import React from 'react';
import { Btn } from '../Btn';

function SimulatorStatusBannersBase({
  studentAssignmentMode,
  assignmentSubmissionAssignment,
  isAssignmentSubmissionClosed,
  assignmentSubmissionState,
  handleSubmitClassAssignment,
  liveMeetingMode,
  isLiveTeacher,
  liveCanEdit,
  liveMeetingShareCode,
  liveSessionCode,
  liveMeetingStatus,
  liveMeetingParticipantCounts,
  liveEditRequestPending,
  handleRequestLiveEditAccess,
  handleEndLiveEditAccess,
  liveGrantedEditors,
  handleRespondToLiveEditRequest,
  livePendingEditRequests,
}) {
  return (
    <>
      {studentAssignmentMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', fontSize: 13 }}>{assignmentSubmissionAssignment?.title || 'Assignment Template'}</strong>
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>
              {isAssignmentSubmissionClosed(assignmentSubmissionAssignment) ? 'Submission closed' : 'Complete the simulation and submit your work here.'}
            </span>
          </div>
          <Btn
            color="var(--accent)"
            onClick={handleSubmitClassAssignment}
            disabled={assignmentSubmissionState.saving || !assignmentSubmissionAssignment || isAssignmentSubmissionClosed(assignmentSubmissionAssignment)}
            title={assignmentSubmissionState.saving ? 'Submitting...' : isAssignmentSubmissionClosed(assignmentSubmissionAssignment) ? 'Submission closed' : 'Submit assignment'}
          >
            {assignmentSubmissionState.data ? 'Update Submission' : 'Submit Assignment'}
          </Btn>
        </div>
      )}

      {liveMeetingMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(90deg, rgba(37,99,235,0.12), rgba(14,165,233,0.08))', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', fontSize: 13 }}>
              {isLiveTeacher ? 'Live simulation host' : (liveCanEdit ? 'Live simulation editor' : 'Live simulation viewer')}
            </strong>
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>
              Code {liveMeetingShareCode || liveSessionCode} • {liveMeetingStatus || 'Connecting'}
              {liveMeetingParticipantCounts.students ? ` • ${liveMeetingParticipantCounts.students} student${liveMeetingParticipantCounts.students > 1 ? 's' : ''} connected` : ''}
            </span>
          </div>
          {isLiveTeacher && (
            <Btn
              color="var(--accent)"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(liveMeetingShareCode || liveSessionCode);
                } catch (error) {
                  console.error('Failed to copy live meeting code', error);
                }
              }}
              title="Copy the live meeting code"
            >
              Copy Code
            </Btn>
          )}
          {!isLiveTeacher && !liveCanEdit && (
            <Btn
              color="var(--orange)"
              onClick={handleRequestLiveEditAccess}
              disabled={liveEditRequestPending}
              title="Ask the teacher for edit access"
            >
              {liveEditRequestPending ? 'Request Sent' : 'Request Edit Access'}
            </Btn>
          )}
          {!isLiveTeacher && liveCanEdit && (
            <Btn
              color="var(--red)"
              onClick={handleEndLiveEditAccess}
              title="End your edit permission"
            >
              End Edit Access
            </Btn>
          )}
        </div>
      )}

      {isLiveTeacher && liveGrantedEditors.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <strong style={{ fontSize: 12 }}>Editors with access:</strong>
          {liveGrantedEditors.map((editor) => (
            <div key={editor.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--card)' }}>
              <span style={{ fontSize: 12 }}>{editor.userName || 'Student'}</span>
              <button type="button" onClick={() => handleRespondToLiveEditRequest(editor.userId, 'revoke')} style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {isLiveTeacher && livePendingEditRequests.length > 0 && (
        <div className="teacher-modal" role="dialog" aria-modal="true" aria-label="Live edit requests">
          <div className="teacher-modal__backdrop" />
          <section className="teacher-modal__content simulator-share-dialog" onClick={(event) => event.stopPropagation()}>
            <header className="teacher-modal__header">
              <h3>Simulation Edit Request</h3>
            </header>
            <p className="simulator-share-dialog__copy">
              Students are read-only by default. Approve a request to temporarily let that student update the shared simulation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {livePendingEditRequests.map((request) => (
                <div key={request.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: 13 }}>{request.userName || 'Student'}</strong>
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>Wants permission to edit the live simulation.</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="simulator-share-dialog__secondary" onClick={() => handleRespondToLiveEditRequest(request.userId, 'deny')}>Deny</button>
                    <button type="button" className="simulator-share-dialog__primary" onClick={() => handleRespondToLiveEditRequest(request.userId, 'approve')}>Allow</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export const SimulatorStatusBanners = React.memo(SimulatorStatusBannersBase);