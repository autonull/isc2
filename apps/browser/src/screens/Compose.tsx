import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { Relation } from '@isc/core';

interface ComposeScreenProps {
  onSubmit: (data: ChannelFormData) => void;
  onCancel: () => void;
  initialData?: Partial<ChannelFormData>;
}

export interface ChannelFormData {
  name: string;
  description: string;
  spread: number;
  relations: Relation[];
}

export function ComposeScreen({ onSubmit, onCancel, initialData }: ComposeScreenProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [spread, setSpread] = useState(initialData?.spread ?? 0.1);
  const [relations, setRelations] = useState<Relation[]>(initialData?.relations || []);
  const [newRelationTag, setNewRelationTag] = useState('');
  const [newRelationObject, setNewRelationObject] = useState('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      spread,
      relations,
    });
  };

  const addRelation = () => {
    if (!newRelationTag.trim()) return;
    setRelations([
      ...relations,
      { tag: newRelationTag.trim(), object: newRelationObject.trim() || undefined },
    ]);
    setNewRelationTag('');
    setNewRelationObject('');
  };

  const removeRelation = (index: number) => {
    setRelations(relations.filter((_, i) => i !== index));
  };

  return (
    <div class="screen compose-screen">
      <header class="screen-header">
        <h1>{initialData ? 'Edit Channel' : 'New Channel'}</h1>
      </header>
      <form class="compose-form" onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="name">Channel Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="e.g., AI Ethics"
            required
          />
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            value={description}
            onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder="What is this channel about?"
            rows={3}
          />
        </div>

        <div class="form-group">
          <label for="spread">Discovery Spread: {Math.round(spread * 100)}%</label>
          <input
            id="spread"
            type="range"
            min="0"
            max="0.3"
            step="0.05"
            value={spread}
            onInput={(e) => setSpread(parseFloat((e.target as HTMLInputElement).value))}
          />
          <span class="hint">Higher = discover more distant peers</span>
        </div>

        <div class="form-group">
          <label>Relations</label>
          <div class="relations-list">
            {relations.map((r, i) => (
              <div key={i} class="relation-tag">
                <span>
                  {r.tag}
                  {r.object ? `: ${r.object}` : ''}
                </span>
                <button type="button" class="remove-btn" onClick={() => removeRelation(i)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div class="relation-input">
            <input
              type="text"
              value={newRelationTag}
              onInput={(e) => setNewRelationTag((e.target as HTMLInputElement).value)}
              placeholder="tag (e.g., about)"
            />
            <input
              type="text"
              value={newRelationObject}
              onInput={(e) => setNewRelationObject((e.target as HTMLInputElement).value)}
              placeholder="object (optional)"
            />
            <button type="button" onClick={addRelation}>
              Add
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" class="submit-btn" disabled={!name.trim()}>
            {initialData ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
