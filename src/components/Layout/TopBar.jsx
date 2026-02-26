import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import Btn from '../Simulator/Btn.jsx'
import { S } from '../Simulator/styles.js'

export default function TopBar() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header style={styles.bar}>
      <button style={styles.logo} onClick={() => navigate("/")}>
        ⚡ OpenHW-Studio
      </button>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {isAuthenticated
            ? <><span style={S.userChip}>👤 {user?.name?.split(' ')[0]}</span><Btn>☁ Save</Btn></>
            : <Btn color="var(--accent)" onClick={() => navigate('/login')}>Sign In to Save</Btn>
        }
      </div>
    </header>
  )
}

const styles = {
  bar: {
    display: "flex",
    alignItems: "center",
    padding: "10px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg2)",
  },
  logo: {
    background: "none",
    border: "none",
    fontSize: 16,
    fontWeight: 700,
    color: "var(--accent)",
    cursor: "pointer",
  },
  nav: {
    display: "flex",
    gap: 12,
    marginLeft: 30,
  },
  user: {
    fontSize: 13,
    color: "var(--text2)",
  },
}