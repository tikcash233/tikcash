import React from 'react';
import PlatformNet from '@/components/ui/PlatformNet.jsx';

export default function AdminPlatformEarnings() {
  // Render the modal inline as the main page content
  return (
    <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Platform earnings</h1>
      <PlatformNet open={true} inline={true} onClose={() => { /* no-op for page */ }} />
    </div>
  );
}
