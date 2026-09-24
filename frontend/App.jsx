import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef } from 'react';
import Landing from './pages/Landing.jsx';
import TrafficNotice from './components/TrafficNotice.jsx';
import { useAuth } from './lib/auth.jsx';
import { api } from './lib/api.js';
import { detectUserTimeZone } from './lib/timezone.js';

const TaffPresentation = lazy(() => import('./components/TaffPresentation.jsx'));
const Info = lazy(() => import('./pages/Info.jsx'));
const Models = lazy(() => import('./pages/Models.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const TermDetail = lazy(() => import('./pages/TermDetail.jsx'));
const PrismDetail = lazy(() => import('./pages/PrismDetail.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ChatRelease = lazy(() => import('./pages/ChatRelease.jsx'));
const CodexRelease = lazy(() => import('./pages/CodexRelease.jsx'));
const Studio = lazy(() => import('./pages/Studio.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

function LoadingScreen(){return <div className="app-loading" role="status"><div className="loading-wordmark">PRISM</div><div className="loading-line"/></div>}
function PrivateRoute({children}){const{user,loading}=useAuth();if(loading)return <LoadingScreen/>;return user?children:<Navigate to="/login" replace/>}
function PublicRoute({children}){const{user,loading}=useAuth();if(loading)return <LoadingScreen/>;return user?<Navigate to="/chat" replace/>:children}
function Surface({name,children}){useEffect(()=>{try{sessionStorage.setItem('prism.active_surface',name);}catch{};return()=>{}},[name]);return children;}
function TimezoneSync(){const{user}=useAuth();const syncedUserRef=useRef(null);useEffect(()=>{if(!user?.id||syncedUserRef.current===user.id)return;syncedUserRef.current=user.id;api.patch('/user/me/timezone',{timezone:detectUserTimeZone()}).catch(()=>{});},[user?.id]);return null}
export default function App(){return <><TimezoneSync/><Suspense fallback={<LoadingScreen/>}><Routes><Route path="/" element={<Landing/>}/><Route path="/prism-taff" element={<TaffPresentation/>}/><Route path="/informacoes" element={<Info/>}/><Route path="/informacoes/:id" element={<PrismDetail type="info"/>}/><Route path="/modelos" element={<Models/>}/><Route path="/modelos/:id" element={<PrismDetail type="models"/>}/><Route path="/termos" element={<Terms/>}/><Route path="/termos/:topic" element={<TermDetail/>}/><Route path="/login" element={<PublicRoute><Login/></PublicRoute>}/><Route path="/register" element={<PublicRoute><Register/></PublicRoute>}/><Route path="/chat" element={<PrivateRoute><Surface name="home"><ChatRelease/><TrafficNotice/></Surface></PrivateRoute>}/><Route path="/codex" element={<PrivateRoute><Surface name="codex"><CodexRelease/><TrafficNotice/></Surface></PrivateRoute>}/><Route path="/studio" element={<PrivateRoute><Studio/></PrivateRoute>}/><Route path="/configuracoes" element={<PrivateRoute><Settings/></PrivateRoute>}/><Route path="/workspace" element={<Navigate to="/studio" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense></>}
