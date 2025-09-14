import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaBarcode, FaClipboardCheck, FaBoxes } from 'react-icons/fa';
import './MobileNavigation.css';

const MobileNavigation = ({ queueCount }) => {
  const location = useLocation();

  const navItems = [
    {
      path: '/',
      icon: <FaBarcode />,
      label: 'Barkod',
      title: 'Barkod Tarama'
    },
    {
      path: '/awb',
      icon: <FaClipboardCheck />,
      label: 'AWB',
      title: 'AWB Kabul'
    },
    {
      path: '/uld',
      icon: <FaBoxes />,
      label: 'ULD',
      title: 'ULD Yükleme'
    }
  ];

  return (
    <nav className="mobile-navigation">
      <div className="nav-container">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            title={item.title}
            data-testid={`nav-${item.path === '/' ? 'barcode' : item.path.slice(1)}`}
          >
            <div className="nav-icon">
              {item.icon}
              {item.path === '/' && queueCount > 0 && (
                <span className="nav-badge">{queueCount}</span>
              )}
            </div>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavigation;
