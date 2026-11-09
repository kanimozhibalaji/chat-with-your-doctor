import React, { useContext, useState, useEffect } from 'react'
import { DoctorContext } from './context/DoctorContext';
import { AdminContext } from './context/AdminContext';
import { Route, Routes, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Admin/Dashboard';
import AllAppointments from './pages/Admin/AllAppointments';
import AddDoctor from './pages/Admin/AddDoctor';
import DoctorsList from './pages/Admin/DoctorsList';
import PatientsList from './pages/Admin/PatientsList';
import Login from './pages/Login';
import DoctorAppointments from './pages/Doctor/DoctorAppointments';
import DoctorDashboard from './pages/Doctor/DoctorDashboard';
import DoctorProfile from './pages/Doctor/DoctorProfile';
import DoctorVideoCall from './pages/Doctor/DoctorVideoCall';
import PrescriptionForm from './pages/Doctor/PrescriptionForm';
import DoctorChatPage from './pages/Doctor/DoctorChatPage';

const App = () => {
  const location = useLocation()
  const { dToken } = useContext(DoctorContext)
  const { aToken } = useContext(AdminContext)

  const [activeDocCallId, setActiveDocCallId] = useState(null)
  const [isDocCallLive, setIsDocCallLive] = useState(false)

  const docVideoMatch = location.pathname.match(/^\/doctor-video-call\/([^/]+)/)
  const routeDocVideoId = docVideoMatch ? docVideoMatch[1] : null

  useEffect(() => {
    if (routeDocVideoId && (!isDocCallLive || routeDocVideoId === activeDocCallId)) {
      setActiveDocCallId(routeDocVideoId)
    } else if (!routeDocVideoId && !isDocCallLive) {
      setActiveDocCallId(null)
    }
  }, [routeDocVideoId, isDocCallLive, activeDocCallId])

  const mountedDocVideoId = dToken ? routeDocVideoId || (isDocCallLive ? activeDocCallId : null) : null
  const isMinimizedDocCall = Boolean(mountedDocVideoId && !routeDocVideoId && isDocCallLive)

  return dToken || aToken ? (
    <div className='bg-[#F8F9FD] min-h-screen'>
      <ToastContainer position="top-right" autoClose={3500} />
      <Navbar />
      <div className='flex items-start'>
        <Sidebar />
        {mountedDocVideoId && (
          <DoctorVideoCall
            key={mountedDocVideoId}
            appointmentIdProp={mountedDocVideoId}
            isMinimized={isMinimizedDocCall}
            onActiveSessionChange={setIsDocCallLive}
          />
        )}
        <Routes>
          <Route path='/' element={
            aToken ? <Dashboard /> : dToken ? <DoctorDashboard /> : <></>
          } />
          <Route path='/admin-dashboard' element={<Dashboard />} />
          <Route path='/all-appointments' element={<AllAppointments />} />
          <Route path='/add-doctor' element={<AddDoctor />} />
          <Route path='/doctor-list' element={<DoctorsList />} />
          <Route path='/patients-list' element={<PatientsList />} />
          <Route path='/doctor-dashboard' element={<DoctorDashboard />} />
          <Route path='/doctor-appointments' element={<DoctorAppointments />} />
          <Route path='/doctor-chat' element={<DoctorChatPage />} />
          <Route path='/doctor-chat/:appointmentId' element={<DoctorChatPage />} />
          <Route path='/doctor-profile' element={<DoctorProfile />} />
          <Route path='/doctor-video-call/:appointmentId' element={null} />
          <Route path='/doctor-prescription/:appointmentId' element={<PrescriptionForm />} />
        </Routes>
      </div>
    </div>
  ) : (
    <>
      <ToastContainer position="top-right" autoClose={3500} />
      <Login />
    </>
  )
}

export default App
