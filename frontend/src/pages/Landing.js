import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Mail, Users, BarChart3, Shield } from 'lucide-react';

export const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Mail className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold" style={{fontFamily: 'Outfit'}}>ESignify</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/login')}
                data-testid="nav-login-btn"
              >
                Login
              </Button>
              <Button 
                onClick={() => navigate('/login')}
                className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                data-testid="nav-get-started-btn"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-primary"
              style={{fontFamily: 'Outfit', letterSpacing: '-0.02em'}}
              data-testid="hero-heading"
            >
              Centralized Email Signature Management
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              Ensure brand consistency across your entire organization. Deploy, manage, and track email signatures at scale.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate('/login')}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] h-12 px-8"
              data-testid="hero-cta-btn"
            >
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#F4F4F5]">
        <div className="max-w-7xl mx-auto">
          <h2 
            className="text-3xl sm:text-4xl font-bold text-center mb-16"
            style={{fontFamily: 'Outfit'}}
          >
            Enterprise-Grade Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Users,
                title: 'Multi-Tenant',
                description: 'Complete data isolation for each organization with scalable architecture'
              },
              {
                icon: Mail,
                title: 'Signature Builder',
                description: 'Visual editor with templates, dynamic fields, and brand consistency'
              },
              {
                icon: BarChart3,
                title: 'Analytics',
                description: 'Track deployment status, email engagement, and compliance reporting'
              },
              {
                icon: Shield,
                title: 'Secure & Compliant',
                description: 'Enterprise security with role-based access and legal disclaimer management'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="bg-white border border-border rounded-lg p-6 hover:shadow-md transition-shadow duration-200"
                data-testid={`feature-card-${index}`}
              >
                <feature.icon className="h-10 w-10 text-[#2563EB] mb-4" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold mb-2" style={{fontFamily: 'Outfit'}}>
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 
            className="text-3xl sm:text-4xl font-bold mb-6"
            style={{fontFamily: 'Outfit'}}
          >
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join organizations using ESignify to manage email signatures effortlessly.
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/login')}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] h-12 px-8"
            data-testid="footer-cta-btn"
          >
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>© 2024 ESignify. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
