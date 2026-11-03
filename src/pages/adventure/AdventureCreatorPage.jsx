import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import AdventureCreatorModal from '../../components/adventure/AdventureCreatorModal.jsx';
import { fetchAdventureMapById } from '../../services/adventureMapService.js';
import { getMyClassrooms } from '../../services/classroomService.js';
import { Loader2 } from 'lucide-react';

export default function AdventureCreatorPage() {
  const { mapId } = useParams();
  const [searchParams] = useSearchParams();
  const classIdFromQuery = searchParams.get('classId') || '';
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(Boolean(mapId));
  const [editingMap, setEditingMap] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [error, setError] = useState(null);

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  // Load editing map if mapId is provided
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        if (mapId) {
          setLoading(true);
          const data = await fetchAdventureMapById(mapId);
          if (!cancelled) {
            setEditingMap(data.map || data);
          }
        }

        if (isTeacher) {
          try {
            const clsList = await getMyClassrooms();
            if (!cancelled) {
              setClassrooms(clsList || []);
            }
          } catch (clsErr) {
            console.warn('Could not load teacher classrooms for adventure creator:', clsErr);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load adventure map');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mapId, isTeacher]);

  const handleClose = () => {
    if (classIdFromQuery) {
      navigate(`/teacher/classes/${classIdFromQuery}`);
    } else if (isTeacher) {
      navigate('/teacher/dashboard');
    } else {
      navigate('/adventure');
    }
  };

  const handleCreated = (savedMap) => {
    const targetMapId = savedMap?._id || savedMap?.id || savedMap?.slug;
    if (classIdFromQuery) {
      navigate(`/teacher/classes/${classIdFromQuery}`);
    } else if (targetMapId) {
      navigate(`/adventure?mapId=${targetMapId}`);
    } else if (isTeacher) {
      navigate('/teacher/dashboard');
    } else {
      navigate('/adventure');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg, #0b0f19)',
        color: 'var(--text, #0f172a)',
        gap: '16px'
      }}>
        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
        <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text2, #64748b)' }}>
          Loading Adventure Studio...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg, #0b0f19)',
        color: 'var(--text, #0f172a)',
        gap: '16px',
        padding: '24px'
      }}>
        <div style={{
          padding: '24px 32px',
          borderRadius: '16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          textAlign: 'center',
          maxWidth: '460px'
        }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#ef4444', fontSize: '18px', fontWeight: '800' }}>
            Unable to Load Adventure Studio
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text2, #64748b)' }}>
            {error}
          </p>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              backgroundColor: '#4f46e5',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdventureCreatorModal
      isOpen={true}
      onClose={handleClose}
      onCreated={handleCreated}
      editingMap={editingMap}
      classrooms={classrooms}
      isTeacher={isTeacher}
      defaultClassroomId={classIdFromQuery}
      lockClassroom={Boolean(classIdFromQuery)}
    />
  );
}

