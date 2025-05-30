
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, GraduationCap, BookOpen } from "lucide-react";

interface RoleSwitcherProps {
  currentRole: string;
  onRoleChange: (role: string) => void;
  email: string;
}

export default function RoleSwitcher({ currentRole, onRoleChange, email }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const roles = [
    { value: 'student', label: 'Étudiant', icon: GraduationCap, color: 'bg-green-100 text-green-700' },
    { value: 'teacher', label: 'Enseignant', icon: BookOpen, color: 'bg-blue-100 text-blue-700' },
  ];

  return (
    <div className="fixed top-4 right-4 z-50">
      {isOpen ? (
        <Card className="w-64">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm">
                <User className="w-4 h-4" />
                <span className="font-medium">Mode de test</span>
              </div>
              <div className="text-xs text-gray-600 mb-3">
                Email: {email}
              </div>
              <div className="space-y-2">
                {roles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <Button
                      key={role.value}
                      variant={currentRole === role.value ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        onRoleChange(role.value);
                        setIsOpen(false);
                      }}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {role.label}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setIsOpen(false)}
              >
                Fermer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center space-x-2">
          <Badge 
            className={`cursor-pointer ${roles.find(r => r.value === currentRole)?.color || 'bg-gray-100 text-gray-700'}`}
            onClick={() => setIsOpen(true)}
          >
            <User className="w-3 h-3 mr-1" />
            Mode: {roles.find(r => r.value === currentRole)?.label || currentRole}
          </Badge>
        </div>
      )}
    </div>
  );
}
