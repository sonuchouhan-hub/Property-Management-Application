
import React, { useState, useEffect } from 'react';
import { View, Project, Plot, Article, UserProfile, AppNotification, PlotStatus, PlotFacing, PlotType } from './types';
import { MOCK_PROJECTS, MOCK_ARTICLES } from './constants';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import ProjectList from './components/ProjectList';
import ProjectDetails from './components/ProjectDetails';
import PlotViewer from './components/PlotViewer';
import Insights from './components/Insights';
import Calculators from './components/Calculators';
import MapView from './components/MapView';
import Contact from './components/Contact';
import SplashScreen from './components/SplashScreen';
import ArticleDetails from './components/ArticleDetails';
import Icon from './components/common/Icon';
import ProfileView from './components/ProfileView';
import Notification from './components/common/Notification';
import NotificationsView from './components/NotificationsView';
import PlotBookings from './components/PlotBookings';


const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [viewHistory, setViewHistory] = useState<View[]>([View.DASHBOARD]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [contactFormPrefill, setContactFormPrefill] = useState<{ projectName: string; plotNumber: string; } | null>(null);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [savedProjectIds, setSavedProjectIds] = useState<number[]>([]);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const currentView = viewHistory[viewHistory.length - 1];

  // --- App Initialization ---
  useEffect(() => {
    try {
      const loggedInUser = localStorage.getItem('dhanshri_currentUser');
      if (loggedInUser) setCurrentUser(JSON.parse(loggedInUser));
      const storedNotifications = localStorage.getItem('dhanshri_notifications');
      if (storedNotifications) setNotifications(JSON.parse(storedNotifications));
    } catch (error) {
      console.error("Failed to parse data from localStorage", error);
    }
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // --- Notification Management ---
  const addNotification = (text: string, link?: AppNotification['link']) => {
    const newNotification: AppNotification = {
      id: Date.now(),
      text,
      timestamp: new Date().toISOString(),
      read: false,
      link,
    };
    setNotifications(prev => {
        const updated = [newNotification, ...prev];
        localStorage.setItem('dhanshri_notifications', JSON.stringify(updated));
        return updated;
    });
  };

  const markNotificationAsRead = (id: number) => {
    setNotifications(prev => {
        const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
        localStorage.setItem('dhanshri_notifications', JSON.stringify(updated));
        return updated;
    });
  };

  useEffect(() => {
    // Simulate a new article notification every 2 minutes
    const interval = setInterval(() => {
      const randomArticle = MOCK_ARTICLES[Math.floor(Math.random() * MOCK_ARTICLES.length)];
      addNotification(`New Insight: Check out our latest article, "${randomArticle.title}"`, { view: View.ARTICLE_DETAILS, id: randomArticle.id });
    }, 120000); // 2 minutes
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // --- Auth Handlers ---
  const handleRegister = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    const users = JSON.parse(localStorage.getItem('dhanshri_users') || '[]');
    if (users.some((user: any) => user.email === email)) {
      return { success: false, message: 'An account with this email already exists.' };
    }
    const newUser = { email, password, mobile: '', profileImage: '' };
    users.push(newUser);
    localStorage.setItem('dhanshri_users', JSON.stringify(users));
    return handleLogin(email, password);
  };

  const handleLogin = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    const users = JSON.parse(localStorage.getItem('dhanshri_users') || '[]');
    const user = users.find((u: any) => u.email === email && u.password === password);
    if (user) {
      const userProfile: UserProfile = { email: user.email, mobile: user.mobile, profileImage: user.profileImage };
      localStorage.setItem('dhanshri_currentUser', JSON.stringify(userProfile));
      setCurrentUser(userProfile);
      return { success: true, message: 'Login successful!' };
    }
    return { success: false, message: 'Invalid email or password.' };
  };

  const handleLogout = () => {
    localStorage.removeItem('dhanshri_currentUser');
    setCurrentUser(null);
    setViewHistory([View.DASHBOARD]); // Reset view
  };

  const handleUpdateUserProfile = (updatedProfile: UserProfile) => {
    setCurrentUser(updatedProfile);
    localStorage.setItem('dhanshri_currentUser', JSON.stringify(updatedProfile));
    const users = JSON.parse(localStorage.getItem('dhanshri_users') || '[]');
    const userIndex = users.findIndex((u: any) => u.email === updatedProfile.email);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updatedProfile };
      localStorage.setItem('dhanshri_users', JSON.stringify(users));
    }
    setToastNotification('Profile updated successfully!');
  };

  // --- Navigation ---
  const navigate = (view: View, type: 'push' | 'replace' = 'push') => {
    if (view !== View.CONTACT) setContactFormPrefill(null);
    window.scrollTo(0, 0);
    setViewHistory(prev => type === 'replace' ? [view] : (prev[prev.length - 1] === view ? prev : [...prev, view]));
  };

  const navigateBack = () => {
    window.scrollTo(0, 0);
    setViewHistory(prev => prev.length > 1 ? prev.slice(0, -1) : [View.DASHBOARD]);
  };

  // --- Project & Plot Handlers ---
  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    navigate(View.PROJECT_DETAILS);
  };

  const handleViewPlots = (project: Project) => {
    setSelectedProject(project);
    navigate(View.PLOT_VIEWER);
  };

  const handleSelectPlot = (plot: Plot | null) => setSelectedPlot(plot);

  const handleBookSiteVisit = (project: Project, plot: Plot) => {
    setContactFormPrefill({ projectName: project.name, plotNumber: plot.number });
    navigate(View.CONTACT);
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (selectedProject?.id === updatedProject.id) setSelectedProject(updatedProject);
    setToastNotification(`Project "${updatedProject.name}" updated successfully!`);
    addNotification(`Project Update: Details for "${updatedProject.name}" have been modified.`, { view: View.PROJECT_DETAILS, id: updatedProject.id });
  };
  
  const handleAddProject = (newProjectData: Omit<Project, 'id' | 'layout' | 'availablePlots'> & {totalPlots: number}) => {
    const generatePlots = (count: number, projectId: number): Plot[] => {
      const plots: Plot[] = [];
      for (let i = 1; i <= count; i++) {
        plots.push({
          id: (projectId * 1000) + i, number: `P-${100 + i}`, size: 1200, dimensions: `30x40`,
          facing: PlotFacing.EAST, status: PlotStatus.AVAILABLE, type: PlotType.NORMAL,
          price: 1200 * 1500, isMortgaged: false,
        });
      }
      return plots;
    };
    
    const newId = Date.now();
    const newLayout = generatePlots(newProjectData.totalPlots, newId);
    const newProject: Project = {
        ...newProjectData,
        id: newId,
        layout: newLayout,
        availablePlots: newLayout.filter(p => p.status === PlotStatus.AVAILABLE).length,
    };
    setProjects(prev => [newProject, ...prev]);
    setToastNotification(`Project "${newProject.name}" added successfully!`);
    addNotification(`New Project Added: Welcome to ${newProject.name}! Explore the new opportunities.`, { view: View.PROJECT_DETAILS, id: newId });
  };
  
  const handleDeleteProject = (projectId: number) => {
    const projectToDelete = projects.find(p => p.id === projectId);
    if (!projectToDelete) return;

    if(window.confirm(`Are you sure you want to delete the project "${projectToDelete.name}"? This action cannot be undone.`)){
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setToastNotification(`Project "${projectToDelete.name}" has been deleted.`);
        addNotification(`Project Removed: ${projectToDelete.name} has been removed from our listings.`);
        if (currentView === View.PROJECT_DETAILS || currentView === View.PLOT_VIEWER) {
            navigate(View.PROJECTS, 'replace');
        }
    }
  };

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    navigate(View.ARTICLE_DETAILS);
  };

  const handleToggleSaveProject = (projectId: number) => {
    setSavedProjectIds(prev => prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]);
  };
  
  const handleNotificationClick = (notification: AppNotification) => {
    markNotificationAsRead(notification.id);
    if (notification.link) {
        if (notification.link.view === View.PROJECT_DETAILS) {
            const project = projects.find(p => p.id === notification.link?.id);
            if (project) handleSelectProject(project);
        } else if (notification.link.view === View.ARTICLE_DETAILS) {
            const article = MOCK_ARTICLES.find(a => a.id === notification.link?.id);
            if (article) handleSelectArticle(article);
        }
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard projects={projects} navigateTo={(view) => navigate(view, 'replace')} selectProject={handleSelectProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} />;
      case View.PROJECTS:
        return <ProjectList projects={projects} onSelectProject={handleSelectProject} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} />;
      case View.PROJECT_DETAILS:
        return selectedProject ? <ProjectDetails project={selectedProject} onViewPlots={handleViewPlots} isSaved={savedProjectIds.includes(selectedProject.id)} onToggleSave={handleToggleSaveProject} /> : <ProjectList projects={projects} onSelectProject={handleSelectProject} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} />;
      case View.PLOT_VIEWER:
        return selectedProject ? <PlotViewer project={selectedProject} selectedPlot={selectedPlot} onSelectPlot={handleSelectPlot} onBookSiteVisit={handleBookSiteVisit} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} /> : <ProjectList projects={projects} onSelectProject={handleSelectProject} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} />;
      case View.INSIGHTS:
        return <Insights onSelectArticle={handleSelectArticle} />;
      case View.ARTICLE_DETAILS:
        return selectedArticle ? <ArticleDetails article={selectedArticle} /> : <Insights onSelectArticle={handleSelectArticle} />;
      case View.CALCULATORS:
        return <Calculators />;
      case View.MAP:
        return <MapView projects={projects} onSelectProject={handleSelectProject}/>;
      case View.CONTACT:
        return <Contact prefillData={contactFormPrefill} />;
      case View.NOTIFICATIONS:
        return <NotificationsView notifications={notifications} onNotificationClick={handleNotificationClick} />;
      case View.PLOT_BOOKINGS:
        return <PlotBookings projects={projects} onUpdateProjects={setProjects} onAddNotification={addNotification} onShowToast={setToastNotification} />;
      case View.SAVED:
        const savedProjects = projects.filter(p => savedProjectIds.includes(p.id));
        return <ProjectList projects={savedProjects} onSelectProject={handleSelectProject} isAdmin={isAdmin} onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} title="My Saved Projects" isSavedList={savedProjects.length > 0} />;
      case View.PROFILE:
        return <ProfileView currentUser={currentUser} onRegister={handleRegister} onLogin={handleLogin} onLogout={handleLogout} onUpdateProfile={handleUpdateUserProfile} />;
      default:
        return <Dashboard projects={projects} navigateTo={(view) => navigate(view, 'replace')} selectProject={handleSelectProject} savedProjectIds={savedProjectIds} onToggleSave={handleToggleSaveProject} />;
    }
  };

  if (loading) return <SplashScreen />;
  if (!currentUser) return <ProfileView currentUser={currentUser} onRegister={handleRegister} onLogin={handleLogin} onLogout={handleLogout} onUpdateProfile={handleUpdateUserProfile} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
       {toastNotification && <Notification message={toastNotification} onClose={() => setToastNotification(null)} />}
      <Header
        isAdmin={isAdmin}
        onToggleAdmin={() => setIsAdmin(!isAdmin)}
        onBack={currentView !== View.DASHBOARD ? navigateBack : undefined}
        notificationCount={notifications.filter(n => !n.read).length}
        onNavigateToNotifications={() => navigate(View.NOTIFICATIONS)}
        user={currentUser}
      />
      <main className="flex-grow pt-16 pb-20 md:pb-4">
        <div className="container mx-auto px-4 py-4">
          {renderContent()}
        </div>
      </main>
      <BottomNav currentView={currentView} setCurrentView={(view) => navigate(view, 'replace')} />
    </div>
  );
};

export default App;
