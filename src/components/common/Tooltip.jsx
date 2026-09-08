//src/components/tooltip.jsx

"use client";

import React, { useState, useRef } from "react";
import PropTypes from "prop-types";

// TooltipProvider: simply renders children. More advanced versions might manage context.
export const TooltipProvider = ({ children }) => {
  return <>{children}</>;
};

TooltipProvider.propTypes = {
  children: PropTypes.node,
};

// Tooltip: Wraps tooltip trigger and content. It manages showing/hiding the tooltip.
export const Tooltip = ({ children }) => {
  // Expecting children to include a TooltipTrigger and a TooltipContent.
  return <div className="relative inline-block">{children}</div>;
};

Tooltip.propTypes = {
  children: PropTypes.node,
};

// TooltipTrigger: Wraps the element that, when hovered, should show the tooltip.
// The `asChild` prop is supported here if you want to pass through the child's properties.
export const TooltipTrigger = ({ asChild, children }) => {
  // We simply render the children; the tooltip functionality is managed by the parent Tooltip.
  return <>{children}</>;
};

TooltipTrigger.propTypes = {
  asChild: PropTypes.bool,
  children: PropTypes.node,
};

// TooltipContent: This component displays the tooltip text. It appears when its parent is hovered.
export const TooltipContent = ({ children }) => {
  // We can use simple CSS to display the tooltip on hover.
  // For this basic implementation, assume the tooltip content is always rendered
  // but hidden by default, then shown on hover of the parent.
  return (
    <div
      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 pointer-events-none transition-opacity duration-200 z-10"
      style={{ whiteSpace: "nowrap" }}
    >
      {children}
    </div>
  );
};

TooltipContent.propTypes = {
  children: PropTypes.node,
};

// A simple hook to manage hover state, used in the Tooltip component.
// You can incorporate this into a more advanced Tooltip implementation if needed.
export const useTooltip = () => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return { ref, visible, show, hide };
};