import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import '../../styles/layout.css';

const MainLayout = ({ title, subtitle, action, children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-canvas">
      <div className="app-shell">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
          <Navbar title={title} subtitle={subtitle} action={action} />
          <main className="page-content page-enter">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;