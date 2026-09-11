import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, PlusCircle, Link2, ArrowLeft } from 'lucide-react';
import { OnboardingLayout } from '../layouts/OnboardingLayout.jsx';
import { Input } from '../components/common/Input.jsx';
import { Button } from '../components/common/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { userApi } from '../api/user.api.js';

// Pulls a raw token out of either a full pasted URL or a bare token, and
// says which of the two distinct flows it belongs to — a personal
// /invitations/:token invite vs a shareable /join/:token workspace link —
// so pasting either kind here routes to the correct page instead of both
// silently being treated as the same thing.
function parseInviteInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const joinMatch = trimmed.match(/\/join\/([^/?#\s]+)/);
  if (joinMatch) return { type: 'join', token: joinMatch[1] };
  const inviteMatch = trimmed.match(/\/invitations\/([^/?#\s]+)/);
  if (inviteMatch) return { type: 'invitation', token: inviteMatch[1] };
  // Bare token, no URL — default to the personal-invitation flow, since
  // that's what "invitation link/token" in the field label refers to.
  return { type: 'invitation', token: trimmed };
}

export function Onboarding() {
  const { user, setUser, createWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  // Within step 3: null = choice screen, 'create' | 'join' = sub-flow.
  const [workspaceMode, setWorkspaceMode] = useState(null);

  // Step 2 — profile
  const [profileName, setProfileName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Step 3 — workspace
  const [wsName, setWsName] = useState('');
  const [wsLoading, setWsLoading] = useState(false);
  const [wsError, setWsError] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    try {
      if (avatarFile) {
        const avatarRes = await userApi.uploadAvatar(avatarFile);
        setUser((prev) => ({ ...prev, avatar: avatarRes.data.avatar || '' }));
      }
      const res = await userApi.updateProfile({ name: profileName, bio });
      setUser(res.data.user);
      setStep(3);
    } catch (err) {
      setProfileError(err.message || 'Could not save your profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setWsLoading(true);
    setWsError('');
    try {
      await createWorkspace(wsName);
      navigate('/dashboard');
    } catch (err) {
      setWsError(err.message || 'Could not create workspace');
    } finally {
      setWsLoading(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    setJoinError('');
    const parsed = parseInviteInput(inviteInput);
    if (!parsed) {
      setJoinError('Paste the invitation link or token your teammate sent you.');
      return;
    }
    // Route to whichever of the two distinct flows this actually is —
    // AcceptInvitation (/invitations/:token) already handles auth
    // requirement, wrong-email, expired, already-accepted, already-a-member;
    // JoinWorkspace (/join/:token) handles the shareable-link flow. Never
    // collapse one into the other.
    navigate(parsed.type === 'join' ? `/join/${parsed.token}` : `/invitations/${parsed.token}`);
  };

  // "Skip onboarding" bypasses the optional welcome/profile steps, but not
  // the workspace step — the app has nowhere useful to send someone with
  // no workspace at all, so skip lands on step 3, not on the dashboard.
  const handleSkip = () => setStep(3);

  if (step === 1) {
    return (
      <OnboardingLayout step={1} onSkip={handleSkip}>
        <div className="text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-4">
            Welcome
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome to WorkSync</h1>
          <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
            Let's set up your workspace in just a few steps. Coordinate your team and ship projects with extreme
            operational clarity.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3 mb-6 text-left">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-900">Core UI Refactoring</p>
              <span className="text-[10px] font-medium text-blue-600">ACTIVE</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-900">Release Sprint 2.4</p>
              <span className="text-[10px] font-medium text-amber-600">PENDING</span>
            </div>
          </div>
          <Button type="button" variant="primary" className="w-full" onClick={() => setStep(2)}>
            Get Started
          </Button>
          <button type="button" onClick={logout} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 mt-4 cursor-pointer">
            Sign out
          </button>
        </div>
      </OnboardingLayout>
    );
  }

  if (step === 2) {
    return (
      <OnboardingLayout step={2} onSkip={handleSkip}>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tell us about yourself</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Help your team identify you during active collaboration.</p>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {profileError && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{profileError}</div>}

          <div className="flex flex-col items-center gap-2 pb-2">
            <label className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden hover:border-blue-400 transition-colors">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-5 h-5 text-slate-400" />
              )}
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
            <span className="text-xs font-semibold text-blue-600">Upload profile photo</span>
          </div>

          <Input label="Full Name" value={profileName} onChange={(e) => setProfileName(e.target.value)} required minLength={2} />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">Bio (optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Lead Product Designer, focused on early-stage workflow tooling"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={profileLoading}>
              {profileLoading ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </form>
      </OnboardingLayout>
    );
  }

  // Step 3 — workspace (choice / create / join)
  if (workspaceMode === 'join') {
    return (
      <OnboardingLayout step={3}>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Join a workspace</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Paste the invitation link or token you were sent.</p>
        <form onSubmit={handleJoin} className="space-y-4">
          {joinError && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{joinError}</div>}
          <Input
            label="Invitation Link"
            placeholder="http://localhost:5173/invitations/..."
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Continue
          </Button>
          <button
            type="button"
            onClick={() => setWorkspaceMode(null)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 pt-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </form>
      </OnboardingLayout>
    );
  }

  if (workspaceMode === 'create') {
    return (
      <OnboardingLayout step={3}>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create your workspace</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Give it a name — you can invite teammates next.</p>
        <form onSubmit={handleCreate} className="space-y-4">
          {wsError && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium">{wsError}</div>}
          <Input
            label="Workspace Name"
            placeholder="e.g. Acme Corp"
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            required
            minLength={2}
          />
          <Button type="submit" variant="primary" className="w-full" disabled={wsLoading}>
            {wsLoading ? 'Creating...' : 'Create Workspace'}
          </Button>
          <button
            type="button"
            onClick={() => setWorkspaceMode(null)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 pt-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </form>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout step={3}>
      <h1 className="text-xl font-bold text-slate-900 tracking-tight">How would you like to get started?</h1>
      <div className="space-y-3 mt-6">
        <button
          type="button"
          onClick={() => setWorkspaceMode('create')}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-left cursor-pointer"
        >
          <PlusCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Create Workspace</p>
            <p className="text-xs text-slate-500">Start a brand new workspace for your team</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceMode('join')}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-left cursor-pointer"
        >
          <Link2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Join Workspace</p>
            <p className="text-xs text-slate-500">Use an invitation link a teammate sent you</p>
          </div>
        </button>
      </div>
      <div className="text-center text-xs text-slate-500 pt-6">
        <button type="button" onClick={logout} className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
          Sign out
        </button>
      </div>
    </OnboardingLayout>
  );
}
