"""
Template validation functions for DMPanda backend.
Validates template names and template data according to template types.
"""

def validate_template_name(name):
    """
    Validate template name.
    Returns (is_valid, error_message)
    """
    if not name or not isinstance(name, str):
        return False, "Template name is required"

    name = name.strip()
    if len(name) == 0:
        return False, "Template name cannot be empty"

    if len(name) > 100:
        return False, "Template name cannot exceed 100 characters"

    return True, ""


def validate_template_data(template_type, template_data):
    """
    Validate template data based on template type.
    Returns (is_valid, field_errors_dict)
    """
    if not template_data or not isinstance(template_data, dict):
        template_data = {}

    errors = {}

    # Basic validation - accept all for now, can be enhanced later
    if template_type not in [
        'template_text', 'template_buttons', 'template_carousel',
        'template_quick_replies', 'template_share_post', 'template_media'
    ]:
        errors['template_type'] = f"Unsupported template type: {template_type}"

    return len(errors) == 0, errors
