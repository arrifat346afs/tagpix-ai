import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfigStore } from '@/store/configStore';
import {
  useTemplateStore,
  addUserTemplate,
  updateUserTemplate,
  deleteUserTemplate,
  editDefaultTemplate,
  resetDefaultTemplate,
  resetAllDefaultTemplates,
  setActiveTemplate,
} from '@/store/templateStore';
import { DEFAULT_TEMPLATES, validateTemplate, interpolateTemplate } from '@/app/lib/metadata/templateUtils';
import { Trash2, Edit, Eye, Plus, Check, RotateCcw } from 'lucide-react';

export const TemplateManager = () => {
  const metadataLimits = useConfigStore((state) => state.metadataLimits);
  const activeTemplateId = useTemplateStore((state) => state.activeTemplateId);
  const userTemplates = useTemplateStore((state) => state.userTemplates);
  const editedDefaultTemplates = useTemplateStore((state) => state.editedDefaultTemplates);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [isEditingDefault, setIsEditingDefault] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [previewMode, setPreviewMode] = useState<string | null>(null);

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      alert('Please provide both template name and content');
      return;
    }

    const validation = validateTemplate(newTemplateContent);
    if (!validation.isValid) {
      alert(`Template is missing required variables: ${validation.missingVariables.join(', ')}`);
      return;
    }

    addUserTemplate({
      name: newTemplateName.trim(),
      template: newTemplateContent.trim(),
    });

    setNewTemplateName('');
    setNewTemplateContent('');
    setEditingTemplate(null);
  };

  const handleUpdateTemplate = (id: string) => {
    const validation = validateTemplate(newTemplateContent);
    if (!validation.isValid) {
      alert(`Template is missing required variables: ${validation.missingVariables.join(', ')}`);
      return;
    }

    updateUserTemplate(id, {
      name: newTemplateName.trim(),
      template: newTemplateContent.trim(),
    });

    setNewTemplateName('');
    setNewTemplateContent('');
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteUserTemplate(id);
    }
  };

  const handleUpdateDefaultTemplate = (id: string) => {
    const validation = validateTemplate(newTemplateContent);
    if (!validation.isValid) {
      alert(`Template is missing required variables: ${validation.missingVariables.join(', ')}`);
      return;
    }

    editDefaultTemplate(id, newTemplateContent.trim());

    setNewTemplateName('');
    setNewTemplateContent('');
    setEditingTemplate(null);
    setIsEditingDefault(false);
  };

  const handleResetDefaultTemplate = (id: string) => {
    if (confirm('Are you sure you want to reset this default template to its original content?')) {
      resetDefaultTemplate(id);
    }
  };

  const handleResetAllDefaults = () => {
    if (confirm('Are you sure you want to reset ALL default templates to their original content?')) {
      resetAllDefaultTemplates();
    }
  };

  const startEdit = (template?: { id: string; name: string; template: string; isPreset?: boolean }) => {
    if (template) {
      setNewTemplateName(template.name);
      setNewTemplateContent(template.template);
      setEditingTemplate(template.id);
      setIsEditingDefault(!!template.isPreset);
    } else {
      setNewTemplateName('');
      setNewTemplateContent('');
      setEditingTemplate('new');
      setIsEditingDefault(false);
    }
  };

  const cancelEdit = () => {
    setNewTemplateName('');
    setNewTemplateContent('');
    setEditingTemplate(null);
    setIsEditingDefault(false);
  };

  const getPreviewContent = (template: string) => {
    return interpolateTemplate(template, {
      titleLimit: metadataLimits.titleLimit,
      descriptionLimit: metadataLimits.descriptionLimit,
      keywordLimit: metadataLimits.keywordLimit,
    });
  };

  const allTemplates = [
    ...DEFAULT_TEMPLATES.map(t => {
      const edited = editedDefaultTemplates?.find(e => e.id === t.id);
      return {
        ...t,
        isPreset: true,
        template: edited ? edited.template : t.template,
        isEdited: !!edited,
      };
    }),
    ...userTemplates.map(t => ({ ...t, isPreset: false, isEdited: false })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Template Management</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your AI prompt templates for metadata generation
        </p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h4 className="text-base font-medium">Available Templates</h4>
            <div className="flex gap-2">
              {(editedDefaultTemplates?.length || 0) > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAllDefaults}
                  className="text-amber-600 border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset All Defaults
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTemplate(null)}
              >
                Use Default
              </Button>
              <Button size="sm" onClick={() => startEdit()}>
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {allTemplates.map((template) => (
              <div
                key={template.id}
                className={`border rounded-lg p-4 transition-colors ${
                  activeTemplateId === template.id
                    ? 'border-primary bg-primary/10 dark:bg-primary/20'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{template.name}</h4>
                      {template.isPreset && (
                        <Badge variant="secondary" className="text-xs">Preset</Badge>
                      )}
                      {template.isEdited && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">Edited</Badge>
                      )}
                      {activeTemplateId === template.id && (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {template.template.substring(0, 100)}...
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewMode(previewMode === template.id ? null : template.id)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {template.isPreset ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(template)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {template.isEdited && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetDefaultTemplate(template.id)}
                            title="Reset to original"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(template)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant={activeTemplateId === template.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveTemplate(template.id)}
                    >
                      {activeTemplateId === template.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        'Use'
                      )}
                    </Button>
                  </div>
                </div>

                {previewMode === template.id && (
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <h5 className="text-sm font-medium mb-2">Preview:</h5>
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground overflow-x-auto">
                      {getPreviewContent(template.template)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Editor Tab */}
        <TabsContent value="editor" className="space-y-4 mt-4">
          <h4 className="text-base font-medium">
            {editingTemplate ? (editingTemplate === 'new' ? 'Create New Template' : 'Edit Template') : 'Template Editor'}
          </h4>

          {editingTemplate ? (
            <div className="space-y-4">
              {isEditingDefault && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    You are editing a default template. Changes will be saved as your custom version.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Template Name</label>
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                  disabled={isEditingDefault}
                  className={isEditingDefault ? "bg-muted" : ""}
                />
                {isEditingDefault && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Default template names cannot be changed
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Template Content</label>
                <Textarea
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  placeholder="Enter your template content..."
                  className="min-h-[300px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use variables like {'{{titleLimit}}'}, {'{{descriptionLimit}}'}, and {'{{keywordLimit}}'} in your template.
                </p>
              </div>

              <div className="flex gap-2">
                {editingTemplate === 'new' ? (
                  <Button onClick={handleCreateTemplate}>
                    Create Template
                  </Button>
                ) : (
                  <Button onClick={() => {
                    if (isEditingDefault) {
                      handleUpdateDefaultTemplate(editingTemplate);
                    } else {
                      handleUpdateTemplate(editingTemplate);
                    }
                  }}>
                    Update Template
                  </Button>
                )}
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border rounded-lg bg-muted/30">
              <p className="text-muted-foreground mb-4">
                Select "Create New" from the Templates tab or edit an existing template to use the editor.
              </p>
              <Button onClick={() => startEdit()}>
                <Plus className="h-4 w-4 mr-2" />
                Start Creating Template
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Variables Tab */}
        <TabsContent value="variables" className="space-y-4 mt-4">
          <h4 className="text-base font-medium">Template Variables</h4>
          <p className="text-sm text-muted-foreground">
            Use these variables in your templates to customize the AI prompts:
          </p>

          <div className="space-y-3">
            <div className="border rounded-lg p-4">
              <code className="text-sm font-semibold">{'{{titleLimit}}'}</code>
              <p className="text-sm text-muted-foreground mt-1">
                The maximum character limit for the title field (currently: {metadataLimits.titleLimit})
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <code className="text-sm font-semibold">{'{{descriptionLimit}}'}</code>
              <p className="text-sm text-muted-foreground mt-1">
                The maximum character limit for the description field (currently: {metadataLimits.descriptionLimit})
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <code className="text-sm font-semibold">{'{{keywordLimit}}'}</code>
              <p className="text-sm text-muted-foreground mt-1">
                The target number of keywords to generate (currently: {metadataLimits.keywordLimit})
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h5 className="font-medium mb-2">Example Template:</h5>
            <pre className="text-sm whitespace-pre-wrap text-muted-foreground overflow-x-auto">
{`Generate metadata for this image.

Requirements:
1. Title:
   - Target approximately {{titleLimit}} characters
   - Write a complete, descriptive title

2. Description:
   - Target under {{descriptionLimit}} characters
   - Write a complete, detailed description

3. Keywords:
   - Provide approximately {{keywordLimit}} keywords
   - Comma-separated

Return ONLY JSON:
{"title": "...", "description": "...", "keywords": "..."}`}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
