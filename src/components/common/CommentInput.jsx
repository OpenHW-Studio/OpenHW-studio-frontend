import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { createClassComment, deleteClassComment, getClassComments } from '../../services/classroomService.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDateTime, getAvatarLetters } from './test.js'

export default function CommentInput({ avatarText, classId, postId, postType, disabled = false }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState('')
  const [visibleCount, setVisibleCount] = useState(2)

  const visibleComments = useMemo(() => comments.slice(0, visibleCount), [comments, visibleCount])

  useEffect(() => {
    let cancelled = false

    const loadComments = async () => {
      setLoadingComments(true)
      try {
        const rows = await getClassComments(classId, postId, postType)
        if (!cancelled) {
          setComments(rows)
          setVisibleCount(2)
        }
      } catch (err) {
        if (!cancelled) {
          setComments([])
        }
      } finally {
        if (!cancelled) {
          setLoadingComments(false)
        }
      }
    }

    loadComments()

    return () => {
      cancelled = true
    }
  }, [classId, postId, postType])

  const handleSubmit = async () => {
    if (!text.trim() || sending || disabled) return

    setSending(true)
    try {
      const comment = await createClassComment(classId, {
        postId,
        postType,
        message: text.trim()
      })
      setComments((current) => [...current, comment])
      setVisibleCount((current) => current + 2)
      setText('')
    } catch (err) {
      console.error('Failed to post comment:', err.message)
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (commentId) => {
    if (!commentId || deletingCommentId) return

    setDeletingCommentId(commentId)
    try {
      await deleteClassComment(classId, commentId)
      setComments((current) => current.filter((comment) => comment._id !== commentId))
    } catch (err) {
      console.error('Failed to delete comment:', err.message)
    } finally {
      setDeletingCommentId('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="teacher-stream-card__discussion-wrap">
      <div className="teacher-stream-card__discussion">
        {loadingComments ? <p className="teacher-stream-card__discussion-state">Loading discussion...</p> : null}

        {!loadingComments && comments.length > 0 ? (
          <div className="teacher-stream-card__discussion-list">
            {visibleComments.map((comment) => {
              const canDelete = user?.role === 'teacher' || comment.createdBy?._id === user?.id || comment.createdBy?._id === user?._id

              return (
              <article key={comment._id} className="teacher-stream-card__discussion-item">
                <div className="teacher-stream-card__discussion-avatar" aria-hidden="true">
                  {getAvatarLetters(comment.createdBy?.name, 'U')}
                </div>
                <div className="teacher-stream-card__discussion-copy">
                  <div className="teacher-stream-card__discussion-meta">
                    <div className="teacher-stream-card__discussion-meta-copy">
                      <strong>{comment.createdBy?.name || 'User'}</strong>
                      <small>{formatDateTime(comment.createdAt)}</small>
                    </div>
                    {canDelete ? (
                      <button
                        type="button"
                        className="teacher-stream-card__discussion-delete"
                        onClick={() => handleDelete(comment._id)}
                        disabled={deletingCommentId === comment._id}
                        aria-label="Delete comment"
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    ) : null}
                  </div>
                  <p>{comment.message}</p>
                </div>
              </article>
              )})}
          </div>
        ) : null}

        {!loadingComments && comments.length > visibleCount ? (
          <button
            type="button"
            className="teacher-stream-card__discussion-more"
            onClick={() => setVisibleCount((current) => current + 2)}
          >
            Show more
          </button>
        ) : null}
      </div>

      <div className="teacher-stream-card__comment">
        <div className="teacher-stream-card__comment-avatar" aria-hidden="true">
          {avatarText}
        </div>
        <input
          type="text"
          placeholder="Discuss in notice..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || sending || !text.trim()}
          aria-label="Send comment"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
