/**
 * QuickContentValidator
 * A fast, deterministic validator that runs basic sanity checks on generated JSON data.
 * This validator does NOT use an LLM and is meant to catch common, obvious errors
 * before the more expensive ContentValidator is called.
 */
export class QuickContentValidator {
  
  /**
   * Validates the JSON data against a set of hardcoded, common-sense rules.
   * @param jsonData The parsed JSON data to validate.
   * @param flowName The name of the flow that generated the data, to tailor rules.
   * @returns An object containing the validation result.
   */
  public validate(jsonData: any, flowName: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Rule set can be extended here.
    // We run checks based on the flow that produced the data.
    if (flowName.startsWith('operationDiscovery')) {
      this.validateOperationDiscovery(jsonData, errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validation rules specific to 'operationDiscovery' flows.
   */
  private validateOperationDiscovery(data: any, errors: string[]): void {
    if (!data.description) {
      errors.push("The 'description' field is null or empty.");
    }
    
    if (!data.validationSources) {
      errors.push("The 'validationSources' object is missing.");
    } else {
      if (!data.validationSources.wsdlFile) {
        errors.push("The 'validationSources.wsdlFile' field is null or empty.");
      }
      if (!data.validationSources.featureFile) {
        errors.push("The 'validationSources.featureFile' field is null or empty.");
      }
    }

    if (data.relativePath && /\s/.test(data.relativePath)) {
        // This is more of a warning, but we can flag it as an error to be strict.
        errors.push("The 'relativePath' contains spaces, which can cause issues.");
    }
  }
}
