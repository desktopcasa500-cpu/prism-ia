import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Landing from './pages/Landing.jsx';
import TaffPresentation from './components/TaffPresentation.jsx';
import InfoV2 from './pages/InfoV2.jsx';
import ModelsV2 from './pages/ModelsV2.jsx';
import TermsV2 from './pages/TermsV2.jsx';
import TermDetail from './pages/TermDetail.jsx';
import PrismDetailV2 from './pages/PrismDetailV2.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ChatReleaseV2 from './pages/ChatReleaseV2.jsx';
import CodexReleaseV2 from './pages/CodexReleaseV2.jsx';
import StudioV2 from './pages/StudioV2.jsx';
import SettingsV2 from './pages/SettingsV2.jsx';
import TrafficNotice from './components/TrafficNotice.jsx';
import { useAuth } from './lib/auth.jsx';
import { api } from './lib/api.js';
import { detectUserTimeZone } from './lib/timezone.js';
function LoadingScreen(){return <div className="app-loading" role="status"><div className="loading-wordmark">PRISM</div><div className="loading-line"/></div>}
function PrivateRoute({children}){const{user,loading}=useAuth();if(loading)return <LoadingScreen/>;return user?children:<Navigate to="/login" replace/>}
function PublicRoute({children}){const{user,loading}=useAuth();if(loading)return <LoadingScreen/>;return user?<Navigate to="/chat" replace/>:children}
function TimezoneSync(){const{user}=useAuth();const syncedUserRef=useRef(null);useEffect(()=>{if(!user?.id||syncedUserRef.current===user.id)return;syncedUserRef.current=user.id;api.patch('/user/me/timezone',{timezone:detectUserTimeZone()}).catch(()=>{});},[user?.id]);return null}
export default function App(){return <><TimezoneSync/><Routes><Route path="/" element={<Landing/>}/><Route path="/prism-taff" element={<TaffPresentation/>}/><Route path="/informacoes" element={<InfoV2/>}/><Route path="/informacoes/:id" element={<PrismDetailV2 type="info"/>}/><Route path="/modelos" element={<ModelsV2/>}/><Route path="/modelos/:id" element={<PrismDetailV2 type="models"/>}/><Route path="/termos" element={<TermsV2/>}/><Route path="/termos/:topic" element={<TermDetail/>}/><Route path="/login" element={<PublicRoute><Login/></PublicRoute>}/><Route path="/register" element={<PublicRoute><Register/></PublicRoute>}/><Route path="/chat" element={<PrivateRoute><><ChatReleaseV2/><TrafficNotice/></></PrivateRoute>}/><Route path="/codex" element={<PrivateRoute><><CodexReleaseV2/><TrafficNotice/></></PrivateRoute>}/><Route path="/studio" element={<PrivateRoute><StudioV2/></PrivateRoute>}/><Route path="/configuracoes" element={<PrivateRoute><SettingsV2/></PrivateRoute>}/><Route path="/workspace" element={<Navigate to="/studio" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></>}
