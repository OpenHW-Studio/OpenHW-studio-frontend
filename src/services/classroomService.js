import { getToken } from './authService.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'

const authHeaders = () => {
  const token = getToken()
  if (!token) {
    throw new Error('No token found. Please sign in again.')
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

const parseResponse = async (response, fallbackErrorMessage) => {
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || fallbackErrorMessage)
  }
  return data
}

export const getMyClassrooms = async () => {
  const response = await fetch(`${BASE_URL}/classroom`, {
    method: 'GET',
    headers: authHeaders()
  })

  const data = await parseResponse(response, 'Failed to fetch classrooms')
  return data.classrooms || []
}

export const getTeacherClassrooms = getMyClassrooms

export const getClassroomById = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}`, {
    method: 'GET',
    headers: authHeaders()
  })

  const data = await parseResponse(response, 'Failed to fetch class details')
  return data.classroom
}

export const createClassroom = async (classroomData) => {
  const response = await fetch(`${BASE_URL}/classroom`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(classroomData)
  })

  const data = await parseResponse(response, 'Failed to create classroom')
  return data.classroom
}

export const updateClassroom = async (classId, classroomData) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(classroomData)
  })

  const data = await parseResponse(response, 'Failed to update classroom')
  return data.classroom
}

export const deleteClassroom = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })

  return parseResponse(response, 'Failed to delete classroom')
}

export const joinClassroomByCode = async (joinCode) => {
  const response = await fetch(`${BASE_URL}/classroom/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ joinCode })
  })

  const data = await parseResponse(response, 'Failed to join classroom')
  return data.classroom
}

export const inviteStudentsToClass = async (classId, payload) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/invite`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  })

  return parseResponse(response, 'Failed to invite students')
}

export const getClassroomStudents = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/students`, {
    method: 'GET',
    headers: authHeaders()
  })

  const data = await parseResponse(response, 'Failed to fetch classroom students')
  return data.students || []
}

export const removeClassroomStudent = async (classId, studentId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/students/${studentId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })

  const data = await parseResponse(response, 'Failed to remove student')
  return data.students || []
}

export const getClassAssignments = async (classId) => {
  const response = await fetch(
    `${BASE_URL}/classroom/assignments?classId=${encodeURIComponent(classId)}&limit=8`,
    {
      method: 'GET',
      headers: authHeaders()
    }
  )

  const data = await parseResponse(response, 'Failed to fetch assignments')
  return data.assignments || []
}

export const createClassAssignment = async (classId, assignmentPayload) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/assignments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(assignmentPayload)
  })

  const data = await parseResponse(response, 'Failed to create assignment')
  return data.assignment
}

export const deleteClassAssignment = async (classId, assignmentId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })

  return parseResponse(response, 'Failed to delete assignment')
}

export const getAssignmentSubmissions = async (classId, assignmentId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/assignments/${assignmentId}/submissions`, {
    method: 'GET',
    headers: authHeaders()
  })

  return parseResponse(response, 'Failed to fetch assignment submissions')
}

export const getClassroomNotices = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/notices?limit=20`, {
    method: 'GET',
    headers: authHeaders()
  })

  const data = await parseResponse(response, 'Failed to fetch notices')
  return data.notices || []
}

export const createClassNotice = async (classId, noticePayload) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/notices`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(noticePayload)
  })

  const data = await parseResponse(response, 'Failed to create notice')
  return data.notice
}

export const deleteClassNotice = async (classId, noticeId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/notices/${noticeId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })

  return parseResponse(response, 'Failed to delete notice')
}

export const updateClassAssignment = async (classId, assignmentId, payload) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/assignments/${assignmentId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  })

  const data = await parseResponse(response, 'Failed to update assignment')
  return data.assignment
}

export const updateClassNotice = async (classId, noticeId, payload) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/notices/${noticeId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  })

  const data = await parseResponse(response, 'Failed to update notice')
  return data.notice
}

export const createClassComment = async (classId, commentPayload) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/comments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(commentPayload)
  })

  const data = await parseResponse(response, 'Failed to add comment')
  return data.comment
}

export const getClassComments = async (classId, postId, postType) => {
  const response = await fetch(
    `${BASE_URL}/classroom/${classId}/comments?postId=${encodeURIComponent(postId)}&postType=${encodeURIComponent(postType)}`,
    {
      method: 'GET',
      headers: authHeaders()
    }
  )

  const data = await parseResponse(response, 'Failed to fetch comments')
  return data.comments || []
}

export const deleteClassComment = async (classId, commentId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders()
  })

  return parseResponse(response, 'Failed to delete comment')
}
